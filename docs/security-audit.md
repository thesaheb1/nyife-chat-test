# Nyife Security Audit — Phase 10

**Date:** 2026-03-06
**Scope:** All 18 microservices, shared libraries, API gateway, frontend

---

## Checklist

### Authentication & Authorization

- [x] **Passwords hashed with bcrypt (cost 12+)**
  - `auth-service/src/models/User.model.js:7` — `BCRYPT_ROUNDS = 12`
  - `admin-service/src/services/admin.service.js:13` — `BCRYPT_ROUNDS = 12`
  - `user-service/src/services/user.service.js:12` — `BCRYPT_ROUNDS = 12`

- [x] **JWT tokens have appropriate expiry**
  - Access token: `15m` (default in `auth-service/src/config/index.js:11`)
  - Refresh token: `7d` (default in `auth-service/src/models/User.model.js:173`)
  - Secrets loaded from `JWT_SECRET` and `JWT_REFRESH_SECRET` env vars

- [x] **Refresh token rotation implemented**
  - `auth-service/src/models/User.model.js:170-174` — separate `generateRefreshToken()` method
  - Refresh tokens stored in httpOnly cookies

- [ ] **CSRF protection on state-changing requests**
  - **NOT IMPLEMENTED** — No CSRF middleware found. Since JWT is in `Authorization` header (not cookie-based session), CSRF risk is lower but not eliminated for endpoints using cookie-based refresh tokens.
  - **Recommendation:** Add `csurf` or double-submit cookie pattern for refresh token endpoint.

### Transport & Headers

- [x] **Helmet on every service**
  - All 18 services confirmed using `helmet()` middleware in `app.js`

- [x] **Rate limiting on auth routes, webhooks, API endpoints**
  - API Gateway: Global rate limiter + stricter auth limiter (`api-gateway/src/app.js:82-102`)
  - Nginx: `limit_req_zone` with 30r/s API and 5r/s auth (`docker/nginx/nginx.conf`)

- [x] **CORS properly configured (specific origins, not *)**
  - 16/18 services: `(process.env.CORS_ORIGINS || 'http://localhost:5173').split(',')`
  - **FIXED:** `organization-service` and `user-service` had `origin: true` (wildcard) — changed to env-based origins

### Input Validation

- [x] **Input validation on every route (Zod)**
  - All services have `validations/` directory with Zod schemas
  - Controllers call `.parse()` before business logic

- [x] **SQL injection prevention (parameterized queries via Sequelize)**
  - All services use Sequelize ORM with parameterized queries
  - `analytics-service` raw SQL uses `replacements` (parameterized) — safe
  - No string concatenation of user input into SQL found

### Webhook & Payment Verification

- [x] **WhatsApp webhook signature verification (Meta X-Hub-Signature-256)**
  - `whatsapp-service/src/middlewares/webhookSignature.js:25-84`
  - Uses `crypto.timingSafeEqual` for constant-time comparison
  - Raw body captured via `express.json({ verify })` for HMAC

- [x] **Razorpay payment signature verification**
  - `wallet-service/src/services/wallet.service.js:172-179`
  - HMAC-SHA256 of `order_id|payment_id` against `RAZORPAY_KEY_SECRET`
  - **FIXED:** Changed from `!==` (timing-attack vulnerable) to `crypto.timingSafeEqual`

### Data Protection

- [x] **Sensitive data encrypted at rest (AES-256)**
  - `shared/shared-utils/src/encryption.js` provides AES-256-CBC encryption utilities
  - Used for WhatsApp access tokens in `wa_accounts` table

- [x] **No secrets in code or logs**
  - All secrets loaded via `process.env` / `dotenv`
  - No hardcoded passwords, API keys, or tokens found in source code
  - `.env.example` files contain only placeholder values

- [x] **Proper error messages (no stack traces in production)**
  - `shared/shared-middleware/src/errorHandler.js:97` — checks `NODE_ENV === 'development'`
  - Stack traces included only when `isDevelopment` is true (lines 117-206)
  - Production responses contain only `success`, `message`, and optionally `errors`
  - API Gateway also strips stacks: `app.js:255-258` sends generic "Internal server error" for non-operational errors

### File Upload Security

- [x] **File upload validation (type, size, content)**
  - `media-service/src/middlewares/upload.js:56-69`
  - MIME type whitelist (`fileFilter` checks against `ALL_ALLOWED` set)
  - File size limit via Multer `limits: { fileSize: MAX_FILE_SIZE }`
  - Files organized by `tenant_id` in storage path

### XSS Prevention

- [x] **XSS prevention (sanitized outputs)**
  - Helmet sets `X-Content-Type-Options: nosniff` on all services
  - JSON-only API responses — no server-rendered HTML
  - Nginx adds `X-XSS-Protection: 1; mode=block` header
  - Frontend uses React (auto-escapes JSX by default)

---

## npm audit Results

| Service | Vulnerabilities | Notes |
|---|---|---|
| api-gateway | 0 | Clean |
| wallet-service | 0 | Clean |
| auth-service | 3 high | `node-tar` via `bcrypt` → `@mapbox/node-pre-gyp` (transitive) |

**auth-service advisory:** `bcrypt@5.x` depends on `@mapbox/node-pre-gyp` which depends on vulnerable `node-tar`. Fix: upgrade to `bcrypt@6.x` when stable (`npm audit fix --force`). This is a build-time dependency for native compilation; runtime risk is low.

---

## Issues Found & Fixed

| # | Severity | Service | Issue | Fix |
|---|---|---|---|---|
| 1 | Medium | organization-service | CORS `origin: true` allows all origins | Changed to `CORS_ORIGINS` env var |
| 2 | Medium | user-service | CORS `origin: true` allows all origins | Changed to `CORS_ORIGINS` env var |
| 3 | Medium | wallet-service | Razorpay signature comparison using `!==` (timing attack) | Changed to `crypto.timingSafeEqual` |

## Open Items (Non-blocking)

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| 1 | Low | No CSRF middleware | Add double-submit cookie pattern for refresh token endpoint |
| 2 | Low | bcrypt 5.x transitive npm audit | Upgrade to bcrypt 6.x when stable |
| 3 | Info | No Content-Security-Policy on API services | Already set by Nginx for frontend; API-only services return JSON |
