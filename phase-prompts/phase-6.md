# Phase 6: Automation & Communications — automation-service, notification-service, email-service

Read CLAUDE.md. Read existing services. This is Phase 6.

**Read before coding automation-service:**
- `docs/whatsapp-reference/business-logic.md` — Section 4 (Chatbot/automation matching: priority, keyword types, flow state in Redis)
- `docs/whatsapp-reference/template-structures.md` — Template send payloads (automations can send template messages as auto-replies)

---

## Task 6.1 — Automation Service (`services/automation-service/` — port 3010)

### Database Migrations:

1. `auto_automations` table:
   - `id` UUID PK, `user_id` FK, `wa_account_id` FK, `name`, `description` TEXT NULL
   - `type` ENUM('basic_reply','advanced_flow','webhook_trigger','api_trigger')
   - `status` ENUM('active','inactive','draft') DEFAULT 'draft'
   - `trigger_config` JSON:
     - Basic reply: `{ "trigger_type": "keyword|contains|exact|regex", "trigger_value": "hello", "match_case": false }`
     - Advanced flow: `{ "trigger_type": "keyword|message_type|webhook|schedule", "trigger_value": "..." }`
     - Webhook: `{ "event_types": ["message_received", "message_status", ...], "url": "https://...", "secret": "..." }`
     - API: `{ "endpoint_path": "/custom-trigger", "method": "POST" }`
   - `action_config` JSON:
     - Reply: `{ "action": "send_message", "message_type": "text|template|interactive", "content": {...} }`
     - Flow: `{ "steps": [...] }` (see advanced flow structure below)
     - Webhook: `{ "url": "...", "method": "POST", "headers": {...}, "payload_template": "..." }`
   - `priority` INT DEFAULT 0 (higher = checked first)
   - `conditions` JSON NULL (additional conditions: time_of_day, contact_tags, etc.)
   - `stats` JSON DEFAULT `{ "triggered_count": 0, "last_triggered_at": null }`
   - `created_at`, `updated_at`, `deleted_at`

2. `auto_automation_logs` table:
   - `id` UUID PK, `automation_id` FK, `user_id` FK
   - `trigger_data` JSON (what triggered it), `action_result` JSON (what happened)
   - `status` ENUM('success','failed'), `error_message` TEXT NULL
   - `contact_phone` VARCHAR NULL
   - `created_at`

3. `auto_webhooks` table (user-configured outbound webhooks):
   - `id` UUID PK, `user_id` FK, `name`, `url` VARCHAR
   - `events` JSON (array of event types to listen for), `secret` VARCHAR (for signature)
   - `headers` JSON NULL, `is_active` BOOLEAN DEFAULT true
   - `last_triggered_at` DATETIME NULL, `failure_count` INT DEFAULT 0
   - `created_at`, `updated_at`, `deleted_at`

### Routes:
- Full CRUD for automations: `POST/GET/GET:id/PUT/DELETE /api/v1/automations`
- `PUT /api/v1/automations/:id/status` — Activate/deactivate
- `GET /api/v1/automations/:id/logs` — View trigger logs with pagination
- Full CRUD for webhooks: `POST/GET/GET:id/PUT/DELETE /api/v1/automations/webhooks`
- `POST /api/v1/automations/webhooks/:id/test` — Send test payload to webhook URL

### Advanced Flow Structure:
```json
{
  "steps": [
    { "id": "step1", "type": "send_message", "config": { "message_type": "text", "content": "Welcome!" }, "next": "step2", "delay_seconds": 0 },
    { "id": "step2", "type": "wait_for_reply", "config": { "timeout_seconds": 300 }, "branches": { "received": "step3", "timeout": "step4" } },
    { "id": "step3", "type": "condition", "config": { "field": "message.text", "operator": "contains", "value": "yes" }, "branches": { "true": "step5", "false": "step6" } },
    { "id": "step5", "type": "send_template", "config": { "template_id": "...", "variables": {...} }, "next": null },
    { "id": "step6", "type": "add_tag", "config": { "tag_id": "..." }, "next": "step7" },
    { "id": "step7", "type": "call_webhook", "config": { "url": "...", "payload": {...} }, "next": null }
  ]
}
```

### Kafka Consumer:
- Consumes `webhook.inbound` — checks incoming messages against active automations
- Matching logic: iterate automations by priority, first match wins
- Execute action: send reply, trigger flow, call webhook, etc.

---

## Task 6.2 — Notification Service (`services/notification-service/` — port 3012)

### Database Migrations:

1. `notif_notifications` table:
   - `id` UUID PK, `user_id` FK (recipient), `sender_type` ENUM('system','admin')
   - `title` VARCHAR, `body` TEXT, `type` ENUM('info','warning','success','error','action')
   - `category` ENUM('general','support','subscription','campaign','system','promotion')
   - `action_url` VARCHAR NULL (link to relevant page)
   - `is_read` BOOLEAN DEFAULT false, `read_at` DATETIME NULL
   - `meta` JSON NULL (extra data)
   - `created_at`, `updated_at`

2. `notif_admin_broadcasts` table:
   - `id` UUID PK, `admin_id` FK (who sent it), `title`, `body` TEXT
   - `target_type` ENUM('all','specific_users'), `target_user_ids` JSON NULL
   - `sent_count` INT DEFAULT 0, `created_at`

### Routes:
- `GET /api/v1/notifications` — User's notifications (paginated, filterable by category, read/unread)
- `GET /api/v1/notifications/unread-count` — Return unread count (polled or sent via Socket.IO)
- `PUT /api/v1/notifications/:id/read` — Mark as read
- `PUT /api/v1/notifications/read-all` — Mark all as read
- `DELETE /api/v1/notifications/:id` — Delete notification

### Kafka Consumer:
- Consumes `notification.send` topic
- Payload: `{ user_id, title, body, type, category, action_url?, meta? }`
- Creates notification record
- Emits Socket.IO event: `socket.emit('notification:new', notification)` to user's room
- If user has email notifications enabled, publish to `email.send` topic

### Socket.IO:
- Namespace: `/notifications`
- On connection, join room `user:{userId}`
- Emit new notifications in real-time

---

## Task 6.3 — Email Service (`services/email-service/` — port 3013)

### Database Migrations:

1. `email_emails` table:
   - `id` UUID PK, `type` ENUM('transactional','marketing','admin_broadcast')
   - `from_email` VARCHAR, `from_name` VARCHAR
   - `to_email` VARCHAR, `to_name` VARCHAR NULL
   - `subject` VARCHAR, `html_body` TEXT, `text_body` TEXT NULL
   - `template_name` VARCHAR NULL (internal email template name)
   - `variables` JSON NULL (template variables)
   - `status` ENUM('pending','sent','failed','bounced') DEFAULT 'pending'
   - `error_message` TEXT NULL, `sent_at` DATETIME NULL
   - `retry_count` INT DEFAULT 0
   - `meta` JSON NULL (related entity info)
   - `created_at`, `updated_at`

2. `email_templates` table (admin-managed email templates):
   - `id` UUID PK, `name` VARCHAR unique (e.g., 'welcome', 'password_reset', 'invoice')
   - `subject` VARCHAR, `html_body` TEXT (Handlebars-style variables: `{{name}}`, `{{link}}`)
   - `text_body` TEXT NULL, `is_active` BOOLEAN DEFAULT true
   - `created_at`, `updated_at`

### Routes (mostly admin):
- `GET /api/v1/emails/templates` — List email templates (admin only)
- `POST /api/v1/emails/templates` — Create template (admin)
- `PUT /api/v1/emails/templates/:id` — Update template (admin)
- `DELETE /api/v1/emails/templates/:id` — Delete (admin)
- `POST /api/v1/emails/send` — Admin send email. Body: `{ to_emails[], subject, html_body }` or `{ to_emails[], template_name, variables }`
- `GET /api/v1/emails` — List sent emails with filters (admin)

### Kafka Consumer:
- Consumes `email.send` topic
- Payload: `{ to_email, to_name?, template_name?, variables?, subject?, html_body? }`
- If template_name provided: load template, replace variables
- Send via Nodemailer (SMTP settings from admin config/env)
- Record in emails table with status

### Email Templates to Seed:
Create seed data for: `welcome`, `email_verification`, `password_reset`, `subscription_activated`, `subscription_expired`, `wallet_recharged`, `invoice`, `campaign_completed`, `support_reply`, `team_invite`

## Update API Gateway + Completion Criteria
- [ ] Automations: basic reply matching works, advanced flow engine works, webhook delivery works
- [ ] Notifications: Kafka → DB → Socket.IO real-time delivery works
- [ ] Emails: Kafka → template resolution → SMTP sending works
- [ ] All seeded email templates present
- [ ] Socket.IO namespaces configured for notifications