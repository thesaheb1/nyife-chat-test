# Phase 4: WhatsApp Core — whatsapp-service, contact-service, template-service, media-service

Read CLAUDE.md. This is Phase 4 — the most complex phase.

**⚠️ MANDATORY — Read these reference docs BEFORE writing any code in this phase:**
- `docs/whatsapp-reference/meta-api-patterns.md` — All Meta API endpoints, message payloads, template CRUD, embedded signup, media
- `docs/whatsapp-reference/webhook-events.md` — All webhook payload structures, signature verification, handler routing logic
- `docs/whatsapp-reference/business-logic.md` — Campaign execution flow, chat architecture, template variable resolution, CSV import, pricing

These contain exact JSON payloads from Meta's official Postman collections. Use them directly in your Axios calls — do NOT guess at payload structures.

---

## Task 4.1 — Media Service (`services/media-service/` — port 3017)

### Database Migrations:
1. `media_files` table:
   - `id` UUID PK, `user_id` FK (tenant), `original_name`, `stored_name` (UUID-based)
   - `mime_type`, `size` INT (bytes), `path` VARCHAR (relative path)
   - `type` ENUM('image','video','audio','document','other')
   - `meta` JSON NULL (dimensions, duration, etc.)
   - `whatsapp_media_id` VARCHAR NULL (after uploading to Meta)
   - `created_at`, `updated_at`, `deleted_at`

### Routes:
- `POST /api/v1/media/upload` — Multer upload. Store in `uploads/{user_id}/{YYYY-MM}/`. Validate file type + size limits. Returns file record.
- `GET /api/v1/media` — List user's media with filters (type, search, pagination)
- `GET /api/v1/media/:id` — Get file info
- `GET /api/v1/media/:id/download` — Stream file download
- `DELETE /api/v1/media/:id` — Soft delete

**Internal:**
- `POST /api/v1/media/upload-to-whatsapp` — Upload file to Meta Cloud API, store returned `media_id`. Body: `{ file_id, phone_number_id }`
- `GET /api/v1/media/whatsapp/:mediaId` — Download media from Meta (for incoming message media)

### Storage:
- Local storage using Multer: `uploads/{user_id}/{YYYY-MM}/{uuid}.{ext}`
- File size limits: images 5MB, videos 16MB, audio 16MB, documents 100MB
- Allowed types: jpg, jpeg, png, webp, mp4, 3gp, mp3, ogg, amr, pdf, doc, docx, xls, xlsx

---

## Task 4.2 — Contact Service (`services/contact-service/` — port 3005)

### Database Migrations:
1. `contact_contacts` table:
   - `id` UUID PK, `user_id` FK (tenant), `phone` VARCHAR (E.164 format), `name` VARCHAR NULL
   - `email` VARCHAR NULL, `company` VARCHAR NULL, `notes` TEXT NULL
   - `custom_fields` JSON NULL, `whatsapp_name` VARCHAR NULL (from WhatsApp profile)
   - `opted_in` BOOLEAN DEFAULT true, `opted_in_at` DATETIME NULL
   - `last_messaged_at` DATETIME NULL, `message_count` INT DEFAULT 0
   - `source` ENUM('manual','csv_import','whatsapp_incoming','api') DEFAULT 'manual'
   - `created_at`, `updated_at`, `deleted_at`
   - Unique constraint on (user_id, phone)

2. `contact_tags` table:
   - `id` UUID PK, `user_id` FK, `name` VARCHAR, `color` VARCHAR DEFAULT '#3B82F6'
   - `created_at`, `updated_at`
   - Unique constraint on (user_id, name)

3. `contact_contact_tags` (junction):
   - `contact_id` FK, `tag_id` FK, PK(contact_id, tag_id)

4. `contact_groups` table:
   - `id` UUID PK, `user_id` FK, `name` VARCHAR, `description` TEXT NULL
   - `contact_count` INT DEFAULT 0, `type` ENUM('static','dynamic') DEFAULT 'static'
   - `dynamic_filters` JSON NULL (for dynamic groups based on tags/fields)
   - `created_at`, `updated_at`, `deleted_at`

5. `contact_group_members` (junction):
   - `contact_id` FK, `group_id` FK, PK(contact_id, group_id), `added_at` DATETIME

### Routes:

**Contacts:**
- `POST /api/v1/contacts` — Create contact. Check subscription limit. Zod: phone (E.164), name?, email?, tags[]?
- `GET /api/v1/contacts` — List with advanced search, filters (tags, groups, opted_in, source, date_range), pagination
- `GET /api/v1/contacts/:id` — Detail with tags and groups
- `PUT /api/v1/contacts/:id` — Update
- `DELETE /api/v1/contacts/:id` — Soft delete
- `POST /api/v1/contacts/bulk-delete` — Bulk soft delete by IDs
- `POST /api/v1/contacts/import/csv` — CSV upload. Parse, validate phones, deduplicate, check subscription limit, create contacts. Return import summary `{ total, created, skipped, errors[] }`. Process async for large files (>500 rows) via Kafka.

**Tags:**
- `POST /api/v1/contacts/tags` — Create tag
- `GET /api/v1/contacts/tags` — List user's tags
- `PUT /api/v1/contacts/tags/:id` — Update
- `DELETE /api/v1/contacts/tags/:id` — Delete (remove from contacts first)
- `POST /api/v1/contacts/:id/tags` — Add tags to contact. Body: `{ tag_ids: [] }`
- `DELETE /api/v1/contacts/:id/tags/:tagId` — Remove tag from contact

**Groups:**
- `POST /api/v1/contacts/groups` — Create group
- `GET /api/v1/contacts/groups` — List groups with contact_count
- `GET /api/v1/contacts/groups/:id` — Group detail with members (paginated)
- `PUT /api/v1/contacts/groups/:id` — Update
- `DELETE /api/v1/contacts/groups/:id` — Soft delete
- `POST /api/v1/contacts/groups/:id/members` — Add contacts to group. Body: `{ contact_ids: [] }`
- `DELETE /api/v1/contacts/groups/:id/members` — Remove contacts. Body: `{ contact_ids: [] }`

---

## Task 4.3 — Template Service (`services/template-service/` — port 3006)

### Database Migrations:
1. `tmpl_templates` table:
   - `id` UUID PK, `user_id` FK, `waba_id` VARCHAR (WhatsApp Business Account ID)
   - `name` VARCHAR (lowercase, underscored — Meta requirement), `display_name` VARCHAR
   - `language` VARCHAR DEFAULT 'en_US', `category` ENUM('MARKETING','UTILITY','AUTHENTICATION')
   - `type` ENUM('standard','authentication','carousel','flow','list_menu')
   - `status` ENUM('draft','pending','approved','rejected','paused','disabled') DEFAULT 'draft'
   - `components` JSON — full template components (header, body, footer, buttons)
   - `rejection_reason` TEXT NULL
   - `meta_template_id` VARCHAR NULL (ID returned by Meta after submission)
   - `last_synced_at` DATETIME NULL
   - `created_at`, `updated_at`, `deleted_at`

### Routes:
- `POST /api/v1/templates` — Create template (draft). Check subscription limit. Validate components structure per type:
  - **Standard:** header (text/image/video/document)?, body (text with {{variables}}), footer?, buttons (quick_reply/url/phone max 3)?
  - **Authentication:** body with {{otp}}, OTP button (copy_code/one_tap)
  - **Carousel:** cards array (min 2, max 10), each with header (image/video), body, buttons
  - **Flow:** flow_id, flow_action, body, footer?, button (flow trigger)
  - **List menu:** body, footer?, button (menu trigger), sections with rows
- `GET /api/v1/templates` — List with filters (status, category, type, search, pagination)
- `GET /api/v1/templates/:id` — Detail
- `PUT /api/v1/templates/:id` — Update draft template
- `DELETE /api/v1/templates/:id` — Delete (only drafts locally, or request deletion from Meta for approved)
- `POST /api/v1/templates/:id/publish` — Submit template to Meta Cloud API for review. Call Meta's template submission endpoint. Update status to 'pending'.
- `POST /api/v1/templates/sync` — Sync all templates from Meta (fetch current status of all submitted templates)

### Template Variable Handling:
- Body text supports `{{1}}`, `{{2}}` etc. placeholders
- On sending, variables are replaced with contact-specific data
- Store example values for Meta submission: `"example": { "body_text": [["John", "Order123"]] }`

---

## Task 4.4 — WhatsApp Service (`services/whatsapp-service/` — port 3009)

### Database Migrations:
1. `wa_accounts` table (WhatsApp Business Accounts):
   - `id` UUID PK, `user_id` FK, `waba_id` VARCHAR (Meta WABA ID)
   - `phone_number_id` VARCHAR, `display_phone` VARCHAR, `verified_name` VARCHAR
   - `business_id` VARCHAR (Meta Business ID), `access_token` TEXT (encrypted AES-256)
   - `quality_rating` ENUM('GREEN','YELLOW','RED') NULL
   - `messaging_limit` VARCHAR NULL, `platform_type` VARCHAR NULL
   - `status` ENUM('active','inactive','restricted','banned') DEFAULT 'active'
   - `webhook_secret` VARCHAR NULL
   - `created_at`, `updated_at`, `deleted_at`
   - Unique constraint on (user_id, phone_number_id)

2. `wa_messages` table (message log):
   - `id` UUID PK, `user_id` FK, `wa_account_id` FK, `contact_phone` VARCHAR
   - `direction` ENUM('inbound','outbound'), `type` VARCHAR (text, image, template, etc.)
   - `content` JSON (message payload), `meta_message_id` VARCHAR NULL (WhatsApp message ID)
   - `status` ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending'
   - `error_code` VARCHAR NULL, `error_message` TEXT NULL
   - `template_id` FK NULL, `campaign_id` FK NULL
   - `pricing_model` VARCHAR NULL, `pricing_category` VARCHAR NULL
   - `created_at`, `updated_at`
   - Index on (user_id, contact_phone, created_at), (meta_message_id)

### Routes:

**WhatsApp Account Management:**
- `POST /api/v1/whatsapp/accounts/embedded-signup` — Handle embedded signup completion. Receives token from frontend SDK, exchanges for permanent token via Meta API, registers phone number, creates account record. Check subscription limit for max_whatsapp_numbers.
- `GET /api/v1/whatsapp/accounts` — List user's WA accounts
- `GET /api/v1/whatsapp/accounts/:id` — Account detail with quality info
- `DELETE /api/v1/whatsapp/accounts/:id` — Deactivate account
- `GET /api/v1/whatsapp/accounts/:id/phone-numbers` — Get registered phone numbers from Meta

**Message Sending:**
- `POST /api/v1/whatsapp/send` — Send single message. Supports all types: text, image, video, audio, document, location, contact, interactive (buttons, list), template, reaction, sticker. Validates message structure per type. Calls Meta Cloud API. Logs message. Debits wallet.
- `POST /api/v1/whatsapp/send/template` — Send template message with variable substitution. Body: `{ wa_account_id, to, template_id, variables: {} }`

**Messages:**
- `GET /api/v1/whatsapp/messages` — Message history with filters (direction, type, status, contact, date_range, pagination)
- `GET /api/v1/whatsapp/messages/:contactPhone` — Conversation history with specific contact

**Webhook:**
- `GET /api/v1/whatsapp/webhook` — Meta webhook verification (verify_token challenge)
- `POST /api/v1/whatsapp/webhook` — Incoming webhook handler:
  1. Verify X-Hub-Signature-256
  2. Parse event type (messages, statuses, errors, template_status, account_update)
  3. For incoming messages: log message, publish to `webhook.inbound` Kafka topic
  4. For status updates: update message status in wa_messages, publish to `campaign.status` if campaign_id present
  5. For template status: update template status in template-service
  6. Respond 200 immediately (process async)

**Developer API (authenticated via API token from user-service):**
- `POST /api/v1/whatsapp/developer/send` — Same as /send but authenticated via API token header instead of JWT

### Meta Cloud API Integration:
- Base URL: `https://graph.facebook.com/v20.0`
- All calls use decrypted access_token from wa_accounts
- Implement retry with exponential backoff for Meta API errors
- Handle rate limiting (respect Meta's rate limit headers)
- Media sending: upload to Meta first (via media-service), then send with media_id

### Kafka:
- **Producer:** `webhook.inbound`, `campaign.status`, `campaign.analytics`
- **Consumer:** `campaign.execute` — receive campaign messages, send via Meta API, publish status

## Update API Gateway:
- Add proxy rules for all 4 services
- WhatsApp webhook routes: NO auth (but signature verification in service)
- Developer API routes: API token auth (different from JWT)
- All other routes: JWT auth

## Completion Criteria
- [ ] All 4 services fully implemented
- [ ] Media upload/download works (local + Meta)
- [ ] Contact CRUD with tags, groups, CSV import works
- [ ] All template types can be created and published to Meta
- [ ] WhatsApp embedded signup flow works
- [ ] All message types can be sent via Meta Cloud API
- [ ] Webhook receives and processes all event types
- [ ] Message status tracking works end-to-end
- [ ] Wallet debited on message send
- [ ] Subscription limits checked on resource creation
- [ ] Developer API with token auth works
