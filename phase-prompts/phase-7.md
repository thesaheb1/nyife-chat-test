# Phase 7: Admin Panel Backend — admin-service, support-service, analytics-service

Read CLAUDE.md. Read existing services. This is Phase 7.

---

## Task 7.1 — Admin Service (`services/admin-service/` — port 3015)

### Database Migrations:

1. `admin_roles` table:
   - `id` UUID PK, `title` VARCHAR (e.g., 'Super Admin', 'Accounts Manager', 'Support Agent')
   - `permissions` JSON — `{ "resources": { "users": { "create":true, "read":true, "update":true, "delete":false }, "dashboard": { "read":true }, "support": { "create":true, "read":true, "update":true, "delete":false }, "plans": {...}, "notifications": {...}, "emails": {...}, "settings": {...}, "sub_admins": {...} } }`
   - `is_system` BOOLEAN DEFAULT false (super_admin role is system, cannot delete)
   - `created_at`, `updated_at`

2. `admin_sub_admins` table:
   - `id` UUID PK, `user_id` FK → auth_users (with role='admin')
   - `role_id` FK → admin_roles, `status` ENUM('active','inactive') DEFAULT 'active'
   - `created_by` FK (super admin who created this sub admin)
   - `last_login_at` DATETIME NULL
   - `created_at`, `updated_at`, `deleted_at`

3. `admin_settings` table:
   - `id` UUID PK, `key` VARCHAR unique, `value` JSON, `group` VARCHAR (general, payment, smtp, sso, tax, frontend, seo)
   - `updated_by` FK NULL, `created_at`, `updated_at`

### Settings Keys to Seed:
```
general: { site_name, site_url, logo_url, favicon_url, company_name, company_address, company_email, company_phone }
seo: { meta_title, meta_description, meta_keywords, og_image }
timezone: { default_timezone: 'Asia/Kolkata', default_currency: 'INR' }
sso: { google: { enabled, client_id, client_secret }, facebook: { enabled, app_id, app_secret } }
payment: { razorpay: { enabled, key_id, key_secret, webhook_secret } }
tax: { enabled, type: 'GST', rate: 18, inclusive: false }
smtp: { host, port, user, pass, from_email, from_name }
frontend: { privacy_policy_html, terms_conditions_html, refund_policy_html }
billing: { company_name, gstin, address, city, state, pincode }
languages: { default: 'en', available: ['en', 'hi'] }
```

### Routes:

**Super Admin Only:**
- `POST /api/v1/admin/sub-admins` — Create sub admin: creates auth_users (role='admin') + admin_sub_admins record. Body: `{ first_name, last_name, email, phone, password, role_id }`
- `GET /api/v1/admin/sub-admins` — List sub admins with pagination
- `PUT /api/v1/admin/sub-admins/:id` — Update sub admin role/status
- `DELETE /api/v1/admin/sub-admins/:id` — Deactivate sub admin

**Admin RBAC Protected:**
- `GET /api/v1/admin/users` — List all users with advanced search (email, name, phone, status), filters (status, plan, date_range), pagination
- `GET /api/v1/admin/users/:id` — User detail: profile + organizations + team members + subscription + wallet balance + recent transactions
- `POST /api/v1/admin/users` — Create user on behalf (auto-verify email)
- `PUT /api/v1/admin/users/:id/status` — Activate/deactivate user
- `DELETE /api/v1/admin/users/:id` — Delete user (only if wallet=0 AND no active plan)
- `POST /api/v1/admin/users/:id/wallet/credit` — Credit user wallet. Body: `{ amount, remarks }`
- `POST /api/v1/admin/users/:id/wallet/debit` — Debit user wallet. Body: `{ amount, remarks }`
- `GET /api/v1/admin/users/:id/transactions` — User's transaction history
- `GET /api/v1/admin/users/:id/subscriptions` — User's subscription history
- `GET /api/v1/admin/users/:id/invoices` — User's invoices

**Plans (admin RBAC: plans resource):**
- Full CRUD: `POST/GET/GET:id/PUT/DELETE /api/v1/admin/plans` — Manage subscription plans
- `PUT /api/v1/admin/plans/:id/status` — Activate/deactivate plan

**Coupons:**
- Full CRUD: `POST/GET/GET:id/PUT/DELETE /api/v1/admin/coupons`

**Notifications (admin broadcast):**
- `POST /api/v1/admin/notifications` — Create and send notification. Body: `{ title, body, target_type, target_user_ids?, send_email? }`
- `GET /api/v1/admin/notifications` — List sent notifications

**Settings:**
- `GET /api/v1/admin/settings` — Get all settings (grouped)
- `GET /api/v1/admin/settings/:group` — Get settings by group
- `PUT /api/v1/admin/settings/:group` — Update settings group
- **Public:** `GET /api/v1/settings/public` — Return non-sensitive settings for frontend (site name, logo, SSO enabled providers, languages, frontend pages)

**Admin RBAC Middleware:**
- Check `req.user.role === 'super_admin'` OR check sub admin's `admin_roles.permissions` for required resource+action
- Return 403 with message if insufficient permissions
- Frontend sidebar items derived from permissions

### Roles Management:
- `POST /api/v1/admin/roles` — Create role with permissions
- `GET /api/v1/admin/roles` — List roles
- `PUT /api/v1/admin/roles/:id` — Update role permissions
- `DELETE /api/v1/admin/roles/:id` — Delete (only if no sub admins assigned)

---

## Task 7.2 — Support Service (`services/support-service/` — port 3014)

### Database Migrations:

1. `support_tickets` table:
   - `id` UUID PK, `ticket_number` VARCHAR unique (auto: NYF-TKT-YYYYMMDD-XXXX)
   - `user_id` FK (who raised), `subject` VARCHAR, `description` TEXT
   - `category` ENUM('billing','technical','account','whatsapp','other')
   - `priority` ENUM('low','medium','high','urgent') DEFAULT 'medium'
   - `status` ENUM('open','in_progress','waiting_on_user','resolved','closed') DEFAULT 'open'
   - `assigned_to` FK NULL (admin/sub-admin user_id)
   - `assigned_at` DATETIME NULL
   - `resolved_at` DATETIME NULL, `closed_at` DATETIME NULL
   - `satisfaction_rating` INT NULL (1-5), `satisfaction_feedback` TEXT NULL
   - `created_at`, `updated_at`

2. `support_ticket_replies` table:
   - `id` UUID PK, `ticket_id` FK, `user_id` FK (who replied — user or admin)
   - `reply_type` ENUM('user','admin','system')
   - `body` TEXT, `attachments` JSON NULL (file URLs)
   - `created_at`

### User Routes:
- `POST /api/v1/support/tickets` — Create ticket. Publish Kafka notification to admins.
- `GET /api/v1/support/tickets` — User's tickets (paginated, filterable)
- `GET /api/v1/support/tickets/:id` — Ticket detail with replies
- `POST /api/v1/support/tickets/:id/reply` — User replies. Publish notification to assigned admin.
- `PUT /api/v1/support/tickets/:id/close` — User closes ticket
- `PUT /api/v1/support/tickets/:id/rate` — Rate resolved ticket (1-5 + feedback)

### Admin Routes:
- `GET /api/v1/admin/support/tickets` — All tickets with advanced search, filters (status, priority, category, assigned_to, user, date_range), pagination
- `GET /api/v1/admin/support/tickets/:id` — Ticket detail with user info
- `POST /api/v1/admin/support/tickets/:id/reply` — Admin replies. Publish notification to user.
- `PUT /api/v1/admin/support/tickets/:id/assign` — Assign to sub admin. Body: `{ admin_user_id }`
- `PUT /api/v1/admin/support/tickets/:id/status` — Update status
- `GET /api/v1/admin/support/tickets/user/:userId` — All tickets for specific user

---

## Task 7.3 — Analytics Service (`services/analytics-service/` — port 3016)

### Database Migrations:

1. `analytics_daily_stats` table:
   - `id` UUID PK, `user_id` FK NULL (null = system-wide/admin stats)
   - `date` DATE, `metric` VARCHAR (e.g., 'messages_sent', 'messages_delivered', 'campaigns_run', 'revenue', 'new_users', 'new_contacts')
   - `value` BIGINT DEFAULT 0, `meta` JSON NULL (breakdown data)
   - Unique constraint: (user_id, date, metric)

### Kafka Consumer:
- Consumes: `campaign.analytics`, `wallet.transaction`, `user.events`, `webhook.inbound`
- Aggregates data into daily_stats table
- Maintains running counters in Redis for real-time dashboard

### User Dashboard Route:
- `GET /api/v1/analytics/dashboard` — Returns:
  - Total contacts, groups, templates (by category/status), campaigns (by status)
  - Messages: sent, delivered, read, failed (today, this week, this month)
  - Wallet balance, recent transactions
  - Active subscription with usage
  - Team members count, organizations count
  - Timeline chart data (messages per day for last 30 days)
  - Quick action buttons data (pending templates, running campaigns, unread chats)

### Admin Dashboard Route:
- `GET /api/v1/admin/analytics/dashboard` — Returns:
  - Revenue: today, this week, this month, this year, total
  - Users: total, active, inactive, new today/week/month
  - Subscriptions: by plan type, active count, expiring soon
  - Messages: total sent, delivered, failed (across all users)
  - Templates: total, by status
  - Support: open tickets, avg resolution time, satisfaction score
  - Finances: total wallet balances, total transactions
  - Filters: date_range, user_id (optional)
  - Charts: revenue timeline, user growth, message volume, subscription distribution

## Update API Gateway + Completion Criteria
- [ ] Admin RBAC works: super admin has full access, sub admins limited by role permissions
- [ ] Admin can manage users, plans, coupons, notifications, settings
- [ ] Support ticket flow works: user creates → admin notified → admin replies → user notified
- [ ] Analytics aggregation from Kafka works
- [ ] Both user and admin dashboards return comprehensive data
- [ ] All settings are seedable and manageable
- [ ] Admin sub admin creation with role assignment works
