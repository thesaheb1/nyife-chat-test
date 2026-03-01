# Phase 3: Subscription & Finance — subscription-service, wallet-service

Read CLAUDE.md. Read existing services (auth, user, organization) to understand established patterns. This is Phase 3.

## Task 3.1 — Subscription Service (`services/subscription-service/` — port 3003)

### Database Migrations:

1. `sub_plans` table:
   - `id` UUID PK, `name` VARCHAR, `slug` unique, `description` TEXT
   - `type` ENUM('monthly','yearly','lifetime'), `price` INT (in paise), `currency` VARCHAR DEFAULT 'INR'
   - `max_contacts` INT, `max_templates` INT, `max_campaigns_per_month` INT
   - `max_messages_per_month` INT, `max_team_members` INT, `max_organizations` INT
   - `max_whatsapp_numbers` INT, `has_priority_support` BOOLEAN DEFAULT false
   - `marketing_message_price` INT (paise), `utility_message_price` INT (paise), `auth_message_price` INT (paise)
   - `features` JSON (extensible feature flags), `is_active` BOOLEAN DEFAULT true, `sort_order` INT DEFAULT 0
   - `created_at`, `updated_at`, `deleted_at`

2. `sub_subscriptions` table:
   - `id` UUID PK, `user_id` FK, `plan_id` FK, `status` ENUM('active','expired','cancelled','pending')
   - `starts_at` DATETIME, `expires_at` DATETIME NULL (null for lifetime)
   - `cancelled_at` DATETIME NULL, `cancellation_reason` TEXT NULL
   - `payment_id` VARCHAR NULL (Razorpay), `amount_paid` INT (paise)
   - `discount_amount` INT DEFAULT 0, `tax_amount` INT DEFAULT 0
   - `coupon_id` FK NULL, `auto_renew` BOOLEAN DEFAULT true
   - `usage` JSON DEFAULT `{}` — `{ "contacts_used": 0, "templates_used": 0, "campaigns_this_month": 0, "messages_this_month": 0, "team_members_used": 0, "organizations_used": 0, "whatsapp_numbers_used": 0 }`
   - `created_at`, `updated_at`

3. `sub_coupons` table:
   - `id` UUID PK, `code` VARCHAR unique, `description` TEXT NULL
   - `discount_type` ENUM('percentage','fixed'), `discount_value` INT
   - `max_uses` INT NULL (null = unlimited), `used_count` INT DEFAULT 0
   - `min_plan_price` INT NULL, `applicable_plan_ids` JSON NULL (null = all plans)
   - `applicable_user_ids` JSON NULL (null = all users, or specific user_ids)
   - `valid_from` DATETIME, `valid_until` DATETIME NULL, `is_active` BOOLEAN DEFAULT true
   - `created_at`, `updated_at`

### Routes:

**Public (no auth needed):**
- `GET /api/v1/subscriptions/plans` — List active plans (sorted by sort_order)
- `GET /api/v1/subscriptions/plans/:slug` — Plan detail

**Authenticated:**
- `POST /api/v1/subscriptions/subscribe` — Subscribe to plan. Validates: user has no active subscription (or upgrade flow). Creates Razorpay order → returns order_id for frontend payment. Body: `{ plan_id, coupon_code? }`
- `POST /api/v1/subscriptions/verify-payment` — Razorpay payment verification callback. Verifies signature, activates subscription, records payment.
- `GET /api/v1/subscriptions/current` — Get user's current active subscription with usage stats
- `POST /api/v1/subscriptions/cancel` — Cancel subscription (mark cancelled, remains active until expires_at)
- `POST /api/v1/subscriptions/coupons/validate` — Validate coupon code, return discount preview. Body: `{ code, plan_id }`
- `GET /api/v1/subscriptions/history` — Subscription history with pagination

**Internal (called by other services):**
- `GET /api/v1/subscriptions/check-limit/:userId/:resource` — Check if user is within plan limits. Resource: contacts, templates, campaigns, messages, team_members, organizations, whatsapp_numbers. Returns `{ allowed: true/false, used: N, limit: N }`
- `POST /api/v1/subscriptions/increment-usage/:userId` — Increment usage counter. Body: `{ resource, count: 1 }`

### Business Logic:
- **Limit enforcement:** Every service that creates a limited resource (contacts, templates, etc.) calls `check-limit` before creation
- **Monthly reset:** Cron job or scheduled task resets `campaigns_this_month` and `messages_this_month` on 1st of each month
- **Expiry check:** Background job checks for expired subscriptions daily, marks them expired
- **Upgrade flow:** If user has active plan and subscribes to new one, prorate or just activate new plan immediately
- **Tax calculation:** Apply tax rate from admin settings (inclusive or exclusive) to plan price
- **Coupon validation:** Check code validity, expiry, usage limits, applicable plans/users, return discount amount

---

## Task 3.2 — Wallet Service (`services/wallet-service/` — port 3004)

### Database Migrations:

1. `wallet_wallets` table:
   - `id` UUID PK, `user_id` FK unique, `balance` INT DEFAULT 0 (in paise), `currency` VARCHAR DEFAULT 'INR'
   - `created_at`, `updated_at`

2. `wallet_transactions` table:
   - `id` UUID PK, `user_id` FK, `wallet_id` FK
   - `type` ENUM('credit','debit'), `amount` INT (paise), `balance_after` INT (paise)
   - `source` ENUM('recharge','message_debit','admin_credit','admin_debit','refund','subscription_payment')
   - `reference_type` VARCHAR NULL (e.g., 'campaign', 'message', 'subscription'), `reference_id` VARCHAR NULL
   - `description` TEXT, `remarks` TEXT NULL (admin remarks for manual credit/debit)
   - `payment_id` VARCHAR NULL (Razorpay), `payment_status` ENUM('pending','completed','failed') DEFAULT 'completed'
   - `meta` JSON NULL (extra info)
   - `created_at`, `updated_at`

3. `wallet_invoices` table:
   - `id` UUID PK, `user_id` FK, `invoice_number` VARCHAR unique (auto-generated: NYF-INV-YYYYMMDD-XXXX)
   - `type` ENUM('subscription','recharge','message_charges')
   - `amount` INT (paise), `tax_amount` INT (paise), `total_amount` INT (paise)
   - `tax_details` JSON (`{ "type": "GST", "rate": 18, "inclusive": false }`)
   - `billing_info` JSON (`{ "name", "email", "address", "gstin" }`)
   - `status` ENUM('paid','pending','cancelled'), `paid_at` DATETIME NULL
   - `reference_type` VARCHAR NULL, `reference_id` VARCHAR NULL
   - `created_at`, `updated_at`

### Routes:

**Authenticated:**
- `GET /api/v1/wallet` — Get wallet balance
- `POST /api/v1/wallet/recharge` — Initiate recharge. Creates Razorpay order. Body: `{ amount }` (minimum 100 INR). Apply tax if configured.
- `POST /api/v1/wallet/recharge/verify` — Verify Razorpay payment, credit wallet, create transaction + invoice
- `GET /api/v1/wallet/transactions` — List transactions with filters: type, source, date_range, pagination
- `GET /api/v1/wallet/invoices` — List invoices with pagination
- `GET /api/v1/wallet/invoices/:id/download` — Generate and download invoice PDF

**Internal (called by other services):**
- `POST /api/v1/wallet/debit` — Debit wallet for message charges. Body: `{ user_id, amount, source, reference_type, reference_id, description }`. Returns `{ success: true/false, balance_after }`. MUST be atomic (use DB transaction + row locking to prevent race conditions).
- `GET /api/v1/wallet/balance/:userId` — Check balance (for pre-campaign validation)

**Admin (called by admin-service):**
- `POST /api/v1/wallet/admin/credit` — Admin credits user wallet. Body: `{ user_id, amount, remarks }`
- `POST /api/v1/wallet/admin/debit` — Admin debits user wallet. Body: `{ user_id, amount, remarks }`

### Business Logic:
- **Atomic debits:** Use MySQL transactions with `SELECT ... FOR UPDATE` on wallet row to prevent double-spending
- **Auto-create wallet:** When user registers (listen to `user.events` Kafka topic), create wallet with 0 balance
- **Invoice generation:** Auto-generate invoice on every payment (subscription or recharge)
- **Message pricing:** When a campaign message is sent, debit wallet based on message type price from subscription plan
- **Insufficient balance:** Return clear error, do not allow negative balance
- **Razorpay integration:** Full payment flow (create order → frontend pays → verify webhook signature → credit)

### Razorpay Integration Details:
- Use `razorpay` npm package
- Create order: `razorpay.orders.create({ amount, currency: 'INR', receipt })`
- Verify payment: validate `razorpay_signature` using `crypto.createHmac('sha256', secret)`
- Also support Razorpay webhook for async payment confirmation

### Update API Gateway:
- Add proxy rules for subscription-service and wallet-service
- Public routes: plans listing
- Authenticated routes: everything else
- Internal routes: only accessible from internal Docker network (not proxied through gateway)

## Completion Criteria
- [ ] Both services fully implemented with all migrations, models, routes, controllers, services, validations
- [ ] Razorpay payment flow works (create order → verify payment)
- [ ] Wallet atomic debit prevents race conditions
- [ ] Subscription limit checking works via internal API
- [ ] Coupon system works (create, validate, apply)
- [ ] Invoices auto-generated
- [ ] Monthly usage reset logic implemented
- [ ] Kafka events for wallet transactions published to analytics
- [ ] All routes have Zod validation and proper error handling
