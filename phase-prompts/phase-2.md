# Phase 2: Core Auth & User Management — auth-service, user-service, organization-service

Read CLAUDE.md first. Read existing code in `shared/` and `services/api-gateway/` to understand patterns. This is Phase 2.

## Pre-check
Before starting, verify Phase 1 is complete:
- Read `shared/shared-middleware/src/authMiddleware.js` — you'll use this
- Read `shared/shared-utils/src/responseFormatter.js` — use for all responses
- Read `shared/shared-config/src/database.js` — use to create DB connections

## Task 2.1 — Auth Service (`services/auth-service/` — port 3001)

### Database Migrations (create in order):
1. `auth_users` table:
   - `id` UUID PK, `email` unique, `password` hashed, `first_name`, `last_name`, `phone`, `avatar_url`
   - `role` ENUM('user','admin','super_admin'), `status` ENUM('active','inactive','suspended','pending_verification')
   - `email_verified_at` DATETIME NULL, `email_verification_token` VARCHAR NULL, `email_verification_expires` DATETIME NULL
   - `password_reset_token` VARCHAR NULL, `password_reset_expires` DATETIME NULL
   - `last_login_at`, `last_login_ip`, `login_count` INT DEFAULT 0
   - `google_id` VARCHAR NULL, `facebook_id` VARCHAR NULL (for OAuth)
   - `created_at`, `updated_at`, `deleted_at` (paranoid/soft delete)

2. `auth_refresh_tokens` table:
   - `id` UUID PK, `user_id` FK → auth_users, `token` VARCHAR(500) unique, `expires_at` DATETIME
   - `device_info` VARCHAR NULL, `ip_address` VARCHAR NULL, `is_revoked` BOOLEAN DEFAULT false
   - `created_at`, `updated_at`

### Models:
- `User.model.js` — Sequelize model matching migration exactly. Include password hashing hook (beforeCreate, beforeUpdate using bcrypt cost 12). Instance methods: `comparePassword(candidatePassword)`, `generateAccessToken()`, `generateRefreshToken()`.
- `RefreshToken.model.js` — Sequelize model with association to User.

### Routes + Controllers + Services + Validations:

**POST /api/v1/auth/register**
- Zod: email, password (min 8, uppercase, lowercase, number, special), first_name, last_name, phone
- Create user with status `pending_verification`
- Generate email verification token (crypto random 64 bytes hex)
- Publish Kafka event to `email.send` topic for verification email
- Return success message (do not auto-login)

**POST /api/v1/auth/verify-email**
- Zod: token
- Find user by token where expires > now
- Set `email_verified_at`, clear token, set status to `active`
- Return success

**POST /api/v1/auth/login**
- Zod: email, password
- Verify credentials, check status is `active` and email verified
- Generate access token (15min expiry) + refresh token (7day expiry)
- Store refresh token in DB
- Set refresh token in httpOnly secure cookie
- Update last_login_at, last_login_ip, increment login_count
- Return `{ accessToken, user: { id, email, first_name, last_name, role, avatar_url } }`

**POST /api/v1/auth/refresh**
- Read refresh token from httpOnly cookie
- Validate token exists in DB, not revoked, not expired
- Generate new access token + new refresh token (rotate)
- Revoke old refresh token
- Return new tokens

**POST /api/v1/auth/logout**
- Revoke current refresh token
- Clear cookie
- Return success

**POST /api/v1/auth/forgot-password**
- Zod: email
- Generate reset token, set expiry (1 hour)
- Publish Kafka event to `email.send` for reset email
- Always return success (prevent email enumeration)

**POST /api/v1/auth/reset-password**
- Zod: token, new_password
- Validate token and expiry
- Hash and update password
- Revoke all refresh tokens for user
- Return success

**POST /api/v1/auth/google** and **POST /api/v1/auth/facebook**
- Passport.js OAuth strategies
- If user exists with matching google_id/facebook_id → login
- If user exists with same email → link account
- If new → create user (email_verified_at = now)
- Return tokens

**GET /api/v1/auth/me** (authenticated)
- Return current user profile from token

### Additional:
- Redis session cache: cache user data for 15 minutes after login (avoid DB hits on every request)
- Rate limiting: 5 attempts per 15 min on login, 3 per hour on forgot-password
- Kafka consumer: listen for `user.events` to update user cache when profile changes
- Dockerfile, .env.example, .sequelizerc, package.json

### Update API Gateway:
- Add proxy rules for auth-service routes
- Public routes (no auth): register, login, verify-email, forgot-password, reset-password, refresh, OAuth
- Protected route: /auth/me, /auth/logout

---

## Task 2.2 — User Service (`services/user-service/` — port 3002)

### Database Migrations:
1. `user_settings` table:
   - `id` UUID PK, `user_id` FK unique, `language` VARCHAR DEFAULT 'en'
   - `timezone` VARCHAR DEFAULT 'Asia/Kolkata', `theme` ENUM('light','dark','system') DEFAULT 'system'
   - `notification_email` BOOLEAN DEFAULT true, `notification_push` BOOLEAN DEFAULT true, `notification_in_app` BOOLEAN DEFAULT true
   - `created_at`, `updated_at`

2. `user_api_tokens` table:
   - `id` UUID PK, `user_id` FK, `name` VARCHAR, `token_hash` VARCHAR (hashed with SHA-256)
   - `token_prefix` VARCHAR(10) (first 10 chars for identification, e.g., "nyf_a3b2c1...")
   - `last_used_at` DATETIME NULL, `expires_at` DATETIME NULL, `is_active` BOOLEAN DEFAULT true
   - `permissions` JSON (which API actions this token allows)
   - `created_at`, `updated_at`

### Routes:

**GET /api/v1/users/profile** — Get full profile
**PUT /api/v1/users/profile** — Update first_name, last_name, phone, avatar (multipart)
**PUT /api/v1/users/password** — Change password (requires current_password + new_password)
**GET /api/v1/users/settings** — Get settings
**PUT /api/v1/users/settings** — Update settings (language, timezone, theme, notifications)
**POST /api/v1/users/api-tokens** — Generate new API token (show full token ONLY on creation)
**GET /api/v1/users/api-tokens** — List tokens (show only prefix + name + last_used)
**DELETE /api/v1/users/api-tokens/:id** — Revoke token
**GET /api/v1/users/api-docs** — Return OpenAPI spec for developer API usage examples

All routes require authentication + tenant middleware.

---

## Task 2.3 — Organization Service (`services/organization-service/` — port 3011)

### Database Migrations:
1. `org_organizations` table:
   - `id` UUID PK, `user_id` FK (owner), `name`, `slug` unique, `description` TEXT NULL
   - `logo_url` NULL, `status` ENUM('active','inactive') DEFAULT 'active'
   - `created_at`, `updated_at`, `deleted_at`

2. `org_team_members` table:
   - `id` UUID PK, `organization_id` FK, `user_id` FK (the owner who invited), `member_user_id` FK → auth_users (the invited member)
   - `role_title` VARCHAR (e.g., 'Sales Agent', 'Marketing Manager')
   - `permissions` JSON — `{ "resources": { "contacts": {"create":true,"read":true,"update":true,"delete":false}, "chat": {...}, "finance": {...}, ... } }`
   - `status` ENUM('active','inactive','invited') DEFAULT 'invited'
   - `invited_at`, `joined_at` NULL
   - `created_at`, `updated_at`, `deleted_at`
   - Unique constraint on (organization_id, member_user_id)

### Routes:

**POST /api/v1/organizations** — Create org (check subscription limit)
**GET /api/v1/organizations** — List user's organizations
**GET /api/v1/organizations/:id** — Get org detail
**PUT /api/v1/organizations/:id** — Update org
**DELETE /api/v1/organizations/:id** — Soft delete

**POST /api/v1/organizations/:id/members** — Invite team member (create auth_users entry if new, send invite email via Kafka)
  - Zod: first_name, last_name, email, role_title, permissions object
  - Check subscription limit for max_team_members
**GET /api/v1/organizations/:id/members** — List members with pagination
**PUT /api/v1/organizations/:id/members/:memberId** — Update member role/permissions
**DELETE /api/v1/organizations/:id/members/:memberId** — Remove member

### RBAC Enforcement:
- Only org owner can manage members
- Team members access resources based on their permissions JSON
- The `rbacMiddleware` from shared-middleware checks `req.user.permissions` on every route

### Update API Gateway:
- Add proxy rules for user-service and organization-service
- All routes require authentication

## Completion Criteria
- [ ] All 3 services fully implemented with migrations, models, routes, controllers, services, validations
- [ ] JWT auth flow works end-to-end (register → verify → login → access protected routes)
- [ ] Refresh token rotation works
- [ ] RBAC middleware enforces permissions
- [ ] All routes have Zod validation
- [ ] Kafka events published for emails
- [ ] API Gateway routes to all 3 services
- [ ] Each service has Dockerfile, .env.example, package.json
