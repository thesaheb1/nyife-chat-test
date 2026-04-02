# Nyife Scalability Review

Date: 2026-04-02

## Executive Summary

Nyife has a strong base for scaling because it is already split into focused services and uses Kafka to decouple high-volume flows such as campaigns, webhook intake, chat updates, analytics, and notifications. That is the right overall direction.

But the project is not yet safely "100k-ready" for the three scenarios below. The biggest gaps are:

- CSV import is still request-bound, memory-heavy, and row-by-row.
- Inbound webhook handling still has a serialization point and too much per-message downstream work.
- Large campaign dispatch still materializes too much state in memory and performs too many per-message internal HTTP calls.
- Infrastructure is still single-node for the most important stateful systems: MySQL, Redis, and Kafka.

## Scenario Verdicts

### 1. Can we create 100k contacts and groups using CSV import?

Verdict: Not scalable today.

Why:

- Contact CSV upload uses `multer.memoryStorage()` in `services/contact-service/src/routes/contact.routes.js`.
- CSV upload size is capped by `CSV_UPLOAD_MAX_SIZE_MB`, which defaults to `10` in `services/contact-service/src/config/index.js`.
- The controller turns the uploaded buffer into a stream only after the full file is already in memory in `services/contact-service/src/controllers/contact.controller.js`.
- `parseCsvRows()` in `services/contact-service/src/services/contact.service.js` collects the whole CSV into an in-memory `rows` array before processing.
- `importCsv()` processes rows sequentially and calls `upsertImportedContact()` row by row.
- `upsertImportedContact()` performs multiple per-row operations:
  - contact lookup/create/update
  - tag lookup/create/assignment
  - group lookup/create/assignment
- Group CSV import is even heavier because `importGroupsCsv()` also assigns memberships one row at a time and triggers repeated group count updates.

What is already scalable here:

- The service already has bulk membership helpers such as `bulkAssignContactsToGroups()`.
- Contact uniqueness is protected at the data level by tenant-scoped uniqueness on contacts.

What is not scalable here:

- Full-file in-memory upload
- Full-file in-memory row parsing
- Synchronous request-response import
- Per-row ORM/database round trips
- Repeated relation work and repeated group count recalculation

Conclusion:

The current CSV architecture may work for small or moderate files, but it is not production-grade for 100k contacts/groups.

### 2. Can we handle 100k incoming messages at a time?

Verdict: Partially scalable foundation, but not safely scalable today.

Why:

- Webhook HTTP handling is better now because it acknowledges quickly and processes asynchronously.
- `services/whatsapp-service/src/services/webhook.service.js` already batches message/status processing, which is a good improvement.
- But inbound Kafka publishing still uses `wabaId` as the key for `WEBHOOK_INBOUND`.
- If 100k inbound messages arrive for one production number/WABA, that traffic can still bottleneck on one partition path even if the topic has multiple partitions.
- In chat-service, inbound processing is still query-heavy:
  - `Conversation.findOrCreate()`
  - `ChatMessage.findOne()` dedupe checks
  - `ChatMessage.create()`
  - repeated `conversation.reload()`
  - socket emits for conversation/message updates
- Automation-service and analytics-service still consume high-volume topics without `partitionsConsumedConcurrently`, unlike campaign/chat/whatsapp/notification services.

What is already scalable here:

- Event-driven intake exists.
- Kafka decouples webhook ingress from downstream processing.
- Chat now has a unique index on `meta_message_id` to reduce duplicate chat rows.
- Consumer concurrency has already been improved in some high-volume services.

What is not scalable here:

- `WEBHOOK_INBOUND` keying by `wabaId`
- Expensive per-message downstream work in chat
- Some consumers still effectively process messages too serially
- Single Kafka broker / single MySQL / single Redis means limited fault tolerance and limited burst absorption

Conclusion:

The current design is better than a synchronous monolith, but I would not call it safe for 100k simultaneous inbound messages without further rework.

### 3. Can we send one campaign to 100k contacts at a time?

Verdict: Improved foundation, but still not production-safe for true 100k campaigns.

Why:

- Campaign execution is now more parallel than before:
  - message-level Kafka keys
  - multiple topic partitions
  - higher consumer concurrency
- That is good and absolutely moves the system in the right direction.
- But `startCampaign()` in `services/campaign-service/src/services/campaign.service.js` still resolves a very large contact set into memory and prepares a large in-memory `messageRecords` array.
- It still calls `CampaignMessage.bulkCreate(messageRecords)` in one large operation.
- For a 100k campaign, that can create large SQL statements, heavy memory pressure, and long lock/transaction times.
- On the send path, `services/whatsapp-service/src/services/message.service.js` still performs expensive per-message internal work such as:
  - subscription lookup
  - wallet lookup
  - wallet debit
  - message-usage increment
- That means one 100k campaign can multiply into a very large number of internal HTTP/database operations even before counting Meta API calls.
- There is still no explicit per-account send-rate controller/token bucket for Meta throughput limits.

What is already scalable here:

- Campaign dispatch is decoupled through Kafka.
- Campaign status updates are now more parallel and indexed better than before.
- Hot topics and consumer concurrency were already improved.
- Contact pagination for audience resolution is better than before.

What is not scalable here:

- Full audience/materialization in memory
- One-shot `CampaignMessage.bulkCreate()` for very large campaigns
- Per-message billing/subscription side effects in the send hot path
- No explicit rate-control layer for Meta API throughput
- No dedicated DLQ/retry/backoff strategy for transient send failures at very high volume

Conclusion:

The project can likely handle larger campaigns than before, but a single 100k campaign is still risky and should not be considered proven-safe yet.

## What Is Already Scalable

These are real strengths in the current architecture:

- Service boundaries are reasonably clear: campaign, chat, whatsapp, notification, analytics, automation, contact, etc.
- Kafka is already used in the correct places for asynchronous fanout.
- Important status paths are event-driven instead of request-chained.
- Recent improvements already increased throughput on some hot paths:
  - campaign/status/message topics use better keys
  - several consumers already use higher concurrency
  - campaign-message lookup indexes exist
  - chat message idempotency improved
- Webhook ingestion no longer blocks the HTTP response for the full downstream processing path.

## What Is Not Scalable Yet

These are the most important current limits:

- CSV import is not built as a background chunk-processing pipeline.
- Inbound webhook fanout still has a partition hot-spot at the WABA level.
- Chat inbound processing still does too much per message.
- Automation and analytics consumers are not yet tuned for the same throughput level as the core messaging consumers.
- Campaign creation/start still builds too much state at once.
- Campaign sending still does too much billing/subscription work per message.
- Infrastructure is still single-instance for the highest-risk stateful dependencies.
- There is no evidence in the codebase of a true 100k load-test harness and formal throughput/SLO validation.

## Most Important Improvements To Prioritize

If we want the biggest practical scale impact, these are the highest-priority improvements:

1. Redesign CSV import as an async chunked import system.
2. Re-key inbound webhook events so one WABA does not serialize all inbound traffic.
3. Reduce per-message chat work and socket fanout cost.
4. Stream 100k campaign audience creation instead of materializing everything at once.
5. Remove per-message wallet/subscription checks from the campaign send hot path.
6. Add real send-rate control and retry strategy around Meta API dispatch.
7. Move Kafka/MySQL/Redis from single-node dev-style topology to HA-capable production topology.
8. Add load testing, lag monitoring, queue-depth monitoring, and slow-query monitoring.

## Complete Implementation Plan

### Phase 1. Rebuild CSV import for 100k+ records

Goal:

Make contact/group import asynchronous, chunked, resumable, and memory-safe.

Implementation:

- Replace `multer.memoryStorage()` for import endpoints with durable file storage.
- Upload the CSV file to object storage or a durable media location.
- Create import-job tables, for example:
  - `contact_import_jobs`
  - `group_import_jobs`
  - optional `import_job_errors`
- API should return immediately with a job id instead of processing the full import in the request.
- Create a dedicated import worker service or worker consumer.
- Parse CSV as a stream and process rows in chunks such as `1k` or `5k`.
- For each chunk:
  - normalize rows
  - batch-lookup existing contacts by phone/email
  - batch-lookup tags/groups by name
  - bulk create missing tags/groups
  - bulk upsert contacts
  - bulk insert tag relations
  - bulk insert group memberships
- Recalculate group counts once per chunk or once per job, not per row.
- Persist job counters:
  - total rows
  - processed rows
  - created
  - updated
  - skipped
  - failed
- Generate a downloadable error CSV for failed rows.
- Add progress endpoints and realtime job progress events.

Success criteria:

- 100k row import does not rely on one long-running HTTP request.
- Worker memory stays bounded by chunk size.
- Job can resume safely after worker restart.

### Phase 2. Make inbound webhook handling truly high-throughput

Goal:

Handle bursty inbound/status webhook traffic without hot partitions or duplicate-heavy downstream work.

Implementation:

- Change `WEBHOOK_INBOUND` Kafka key from `wabaId` to a higher-cardinality key such as:
  - `meta_message_id`
  - or `phone_number_id + contact_phone`
- Keep raw Meta webhook handling authoritative and idempotent.
- Add a stronger uniqueness guarantee for `wa_messages` on inbound message ids so duplicates cannot create duplicate rows during webhook retries.
- Split webhook downstream processing more deliberately:
  - chat projection
  - automation trigger
  - analytics counters
  - campaign/status projection
- Tune automation-service and analytics-service to use `partitionsConsumedConcurrently`.
- Reduce chat per-message cost:
  - avoid full `conversation.reload()` on every message
  - update only minimal conversation fields
  - debounce conversation list/socket broadcasts where possible
- Add backpressure-safe error handling:
  - DLQ for poison events
  - retry with backoff for transient failures
- Add consumer lag and webhook processing latency metrics.

Success criteria:

- One large inbound burst is distributed across partitions.
- Duplicate webhook delivery remains idempotent.
- Chat, automation, and analytics do not block each other.

### Phase 3. Rebuild 100k campaign dispatch and send path

Goal:

Make 100k-recipient campaign creation/start/send memory-safe, more parallel, and operationally predictable.

Implementation:

- Stop materializing the full audience in memory before insert.
- Resolve audience in pages/chunks and process incrementally.
- Create campaign messages in chunks, for example `1k` or `5k` rows at a time.
- Publish `campaign.execute` events as each chunk is inserted instead of waiting for the full audience.
- Store campaign audience generation progress separately from message-send progress.
- Add explicit per-WhatsApp-account dispatch limits:
  - rate limiter
  - concurrency limit
  - token bucket based on Meta throughput limits
- Move billing/subscription checks out of the per-message hot path:
  - reserve campaign budget once before starting
  - batch-debit/reconcile usage asynchronously
  - batch subscription usage counters
- Add transient error retry/backoff for send failures such as 429/5xx/network issues.
- Add DLQ for campaign execute failures that exceed retry policy.
- Keep media/template resolution cached per campaign execution pass where possible.

Success criteria:

- Starting a 100k campaign does not create one enormous SQL statement or one enormous in-memory array.
- Send throughput is limited by configured rate control, not by accidental bottlenecks.
- Billing side effects do not dominate send latency.

### Phase 4. Scale infrastructure for real production volume

Goal:

Remove single-node bottlenecks and improve fault tolerance.

Implementation:

- Move Kafka from single broker to multi-broker cluster with replication factor greater than `1`.
- Move MySQL to a production HA setup or managed service with backup/replica strategy.
- Move Redis to a production-managed or replicated setup.
- Separate API containers from worker containers where load characteristics differ.
- Add horizontal replicas for high-volume workers:
  - whatsapp-service
  - campaign-service
  - chat-service
  - automation-service
  - analytics-service
  - notification-service
- Revisit container CPU/memory limits based on measured throughput.
- Tune MySQL pools and query patterns for high-volume consumers.

Success criteria:

- A single broker/db/container failure does not take down the full messaging pipeline.
- Throughput scales horizontally by adding workers/partitions.

### Phase 5. Add observability, capacity planning, and load validation

Goal:

Prove scale with measurements instead of assumptions.

Implementation:

- Add dashboards for:
  - Kafka consumer lag
  - webhook ingest rate
  - campaign dispatch rate
  - send success/failure rate
  - status update latency
  - chat projection latency
  - MySQL slow queries
  - Redis error rates
- Add alerts for:
  - consumer lag threshold breaches
  - DLQ growth
  - webhook processing failures
  - send failure spikes
  - DB saturation
- Build repeatable load tests for:
  - 100k contact CSV import
  - 100k inbound burst
  - 100k campaign send with 50% fast read receipts
- Define concrete readiness targets, for example:
  - campaign dispatch throughput target
  - max webhook-to-status latency
  - acceptable consumer lag under burst
  - acceptable DB CPU/query latency

Success criteria:

- We can prove, with metrics, whether Nyife is ready for a specific volume target.

## Recommended Delivery Order

If we want the fastest practical path to a more scalable platform, the order should be:

1. Phase 1: CSV import redesign
2. Phase 2: inbound webhook partitioning + idempotency + consumer tuning
3. Phase 3: chunked 100k campaign dispatch + rate limiting + billing redesign
4. Phase 4: infrastructure HA and horizontal scale
5. Phase 5: load testing and operational dashboards

## Bottom Line

Nyife is already on the right architectural path, but it is not yet safe to claim that it can reliably handle:

- 100k contacts/groups import by CSV
- 100k inbound messages at the same time
- a single 100k-recipient campaign

It has some scalable foundations already, but the import pipeline, inbound fanout path, campaign send path, and infrastructure topology still need deliberate redesign and load validation before those scenarios can be called production-ready.
