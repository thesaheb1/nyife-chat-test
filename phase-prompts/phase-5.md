# Phase 5: Campaigns & Chat — campaign-service, chat-service

Read CLAUDE.md. Read existing whatsapp-service, contact-service, template-service code. This is Phase 5.

**Read before coding:**
- `docs/whatsapp-reference/business-logic.md` — Section 1 (Campaign execution flow with Kafka batching, rate limiting, retry), Section 2 (Real-time chat architecture, Socket.IO rooms), Section 7 (Message pricing)
- `docs/whatsapp-reference/template-structures.md` — Template send payloads for all types (campaign-service must build correct component parameters when sending templates to contacts)
- `docs/whatsapp-reference/webhook-events.md` — Status updates section (sent/delivered/read/failed) for campaign tracking

---

## Task 5.1 — Campaign Service (`services/campaign-service/` — port 3007)

### Database Migrations:

1. `camp_campaigns` table:
   - `id` UUID PK, `user_id` FK, `wa_account_id` FK, `name` VARCHAR, `description` TEXT NULL
   - `template_id` FK, `status` ENUM('draft','scheduled','running','paused','completed','failed','cancelled') DEFAULT 'draft'
   - `type` ENUM('immediate','scheduled')
   - `target_type` ENUM('group','contacts','tags','all') — who receives it
   - `target_config` JSON — `{ group_ids: [], contact_ids: [], tag_ids: [], exclude_tag_ids: [] }`
   - `variables_mapping` JSON — maps template variables to contact fields: `{ "1": "name", "2": "custom_fields.order_id" }`
   - `scheduled_at` DATETIME NULL, `started_at` DATETIME NULL, `completed_at` DATETIME NULL
   - `total_recipients` INT DEFAULT 0, `sent_count` INT DEFAULT 0, `delivered_count` INT DEFAULT 0
   - `read_count` INT DEFAULT 0, `failed_count` INT DEFAULT 0, `pending_count` INT DEFAULT 0
   - `estimated_cost` INT DEFAULT 0 (paise), `actual_cost` INT DEFAULT 0 (paise)
   - `error_summary` JSON NULL
   - `created_at`, `updated_at`, `deleted_at`

2. `camp_campaign_messages` table:
   - `id` UUID PK, `campaign_id` FK, `contact_id` FK, `contact_phone` VARCHAR
   - `status` ENUM('pending','queued','sent','delivered','read','failed') DEFAULT 'pending'
   - `meta_message_id` VARCHAR NULL, `variables` JSON (resolved variables for this contact)
   - `error_code` VARCHAR NULL, `error_message` TEXT NULL
   - `sent_at` DATETIME NULL, `delivered_at` DATETIME NULL, `read_at` DATETIME NULL, `failed_at` DATETIME NULL
   - `cost` INT DEFAULT 0 (paise)
   - `retry_count` INT DEFAULT 0, `max_retries` INT DEFAULT 3
   - `created_at`, `updated_at`
   - Index on (campaign_id, status), (contact_phone)

### Routes:
- `POST /api/v1/campaigns` — Create campaign (draft). Check subscription limit (campaigns_per_month). Resolve target contacts, calculate total_recipients and estimated_cost. Validate template is approved.
- `GET /api/v1/campaigns` — List with filters (status, date_range, search, pagination)
- `GET /api/v1/campaigns/:id` — Detail with stats summary
- `PUT /api/v1/campaigns/:id` — Update draft campaign
- `DELETE /api/v1/campaigns/:id` — Delete draft
- `POST /api/v1/campaigns/:id/start` — Start campaign execution:
  1. Check subscription message limit
  2. Check wallet balance ≥ estimated_cost
  3. Resolve all target contacts
  4. Create campaign_messages records for each contact
  5. Publish messages in batches (50 per batch) to `campaign.execute` Kafka topic
  6. Update status to 'running'
  7. Emit Socket.IO event for real-time campaign status
- `POST /api/v1/campaigns/:id/pause` — Pause running campaign (stop sending queued messages)
- `POST /api/v1/campaigns/:id/resume` — Resume paused campaign
- `POST /api/v1/campaigns/:id/cancel` — Cancel campaign
- `POST /api/v1/campaigns/:id/retry` — Retry failed messages:
  1. Find all campaign_messages with status 'failed' and retry_count < max_retries
  2. Re-queue them to Kafka
  3. Increment retry_count
- `GET /api/v1/campaigns/:id/messages` — List campaign messages with filters (status, pagination)
- `GET /api/v1/campaigns/:id/analytics` — Detailed analytics: delivery rate, read rate, failure reasons breakdown, cost breakdown, timeline chart data

### Kafka:
- **Producer:** `campaign.execute` (batched messages to whatsapp-service)
- **Consumer:** `campaign.status` — receives delivery status from whatsapp-service, updates campaign_messages and campaign aggregate counts. Emits Socket.IO events for real-time dashboard updates.

### Campaign Execution Flow:
1. User creates campaign → selects template + target audience → reviews cost
2. User clicks start → system validates limits + balance → resolves contacts
3. Messages published to Kafka in batches of 50
4. whatsapp-service consumes, sends each via Meta API, publishes status
5. campaign-service consumes status, updates records, emits real-time events
6. For each sent message, wallet-service debits per-message cost
7. Dashboard shows live counters via Socket.IO

---

## Task 5.2 — Chat Service (`services/chat-service/` — port 3008)

### Database Migrations:

1. `chat_conversations` table:
   - `id` UUID PK, `user_id` FK (tenant), `wa_account_id` FK
   - `contact_phone` VARCHAR, `contact_name` VARCHAR NULL
   - `last_message_at` DATETIME, `last_message_preview` VARCHAR(200)
   - `unread_count` INT DEFAULT 0
   - `assigned_to` FK NULL (team member user_id)
   - `assigned_at` DATETIME NULL, `assigned_by` FK NULL
   - `status` ENUM('open','closed','pending') DEFAULT 'open'
   - `tags` JSON NULL
   - `created_at`, `updated_at`
   - Unique constraint: (user_id, wa_account_id, contact_phone)
   - Index on (user_id, last_message_at DESC)

2. `chat_messages` table:
   - `id` UUID PK, `conversation_id` FK, `user_id` FK
   - `direction` ENUM('inbound','outbound'), `sender_type` ENUM('contact','user','team_member','system')
   - `sender_id` VARCHAR NULL (user_id or team member id for outbound)
   - `type` VARCHAR (text, image, template, etc.), `content` JSON
   - `meta_message_id` VARCHAR NULL
   - `status` ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending'
   - `created_at`
   - Index on (conversation_id, created_at)

### Routes:
- `GET /api/v1/chat/conversations` — List conversations with filters (status, assigned_to, unread, search by contact name/phone, pagination, sorted by last_message_at DESC)
- `GET /api/v1/chat/conversations/:id` — Conversation detail
- `GET /api/v1/chat/conversations/:id/messages` — Message history (paginated, load more = older messages)
- `POST /api/v1/chat/conversations/:id/send` — Send message in conversation. Supports all message types. Calls whatsapp-service to send. Saves message. Emits Socket.IO event.
- `POST /api/v1/chat/conversations/:id/assign` — Assign conversation to team member. Body: `{ member_user_id }`. Check RBAC — member must have chat permission.
- `PUT /api/v1/chat/conversations/:id/status` — Update conversation status (open/closed)
- `POST /api/v1/chat/conversations/:id/read` — Mark conversation as read (reset unread_count)

### Socket.IO Events:
```
// Client → Server
socket.emit('join:conversations', { userId })  // Join user's conversation room
socket.emit('join:conversation', { conversationId })  // Join specific chat
socket.emit('typing', { conversationId })

// Server → Client  
socket.emit('new:message', { conversationId, message })  // New incoming/outgoing message
socket.emit('message:status', { conversationId, messageId, status })  // Delivery status
socket.emit('conversation:updated', { conversation })  // Conversation list update
socket.emit('typing:indicator', { conversationId, senderType })
```

### Kafka Consumer:
- Consumes `webhook.inbound` topic from whatsapp-service
- For incoming messages:
  1. Find or create conversation
  2. Save message to chat_messages
  3. Increment unread_count
  4. Update conversation last_message
  5. Emit Socket.IO event to all connected clients for this user
  6. If automation exists, forward to automation-service

### Socket.IO Setup:
- Use Redis adapter for multi-instance support
- Authenticate socket connections via JWT (handshake auth)
- Room management: user rooms + conversation rooms
- Namespace: `/chat`

## Update API Gateway:
- Proxy campaign-service and chat-service routes
- WebSocket proxy for Socket.IO at `/socket.io` namespace

## Completion Criteria
- [ ] Campaign full lifecycle: create → start → execute → track → retry
- [ ] Kafka-based campaign execution with batching works
- [ ] Real-time campaign status via Socket.IO
- [ ] Wallet debited per message during campaign
- [ ] Chat conversations auto-created on incoming messages
- [ ] Real-time chat via Socket.IO works
- [ ] Chat assignment to team members works with RBAC
- [ ] Message history with pagination works
- [ ] All routes validated with Zod