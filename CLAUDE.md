# CLAUDE.md — Nyife: WhatsApp Marketing SaaS Platform

## ⚠️ CRITICAL RULES (NEVER VIOLATE)

1. **NEVER use `sequelize.sync()`** — Only Sequelize migrations via `npx sequelize-cli db:migrate`
2. **NEVER hardcode secrets** — All secrets in `.env` files, loaded via `dotenv`
3. **NEVER skip input validation** — Every route uses Zod schemas
4. **NEVER create monolithic code** — Each microservice is an independent Express app with its own `package.json`
5. **NEVER assume context from previous phases** — Always read existing code before modifying
6. **NEVER generate placeholder/stub code** — Every function must be fully implemented and production-ready
7. **NEVER skip error handling** — Every async route wrapped in try-catch with proper error responses
8. **NEVER create files without updating the service index** — Register all routes, middlewares, models

## Project Overview

**Nyife** is a multi-tenant WhatsApp Marketing SaaS platform built with Node.js microservices architecture. It allows businesses to manage WhatsApp Business accounts, send campaigns, chat with customers, create automations, and manage teams — all through a subscription-based model.

## Architecture Overview

```
nyife/
├── services/                    # Backend microservices
│   ├── api-gateway/             # Kong/Express gateway - routing, rate limiting, auth verification
│   ├── auth-service/            # Authentication, JWT, OAuth, sessions
│   ├── user-service/            # User profiles, settings, developer tools
│   ├── subscription-service/    # Plans, subscriptions, coupons, limits enforcement
│   ├── wallet-service/          # Wallet, transactions, invoices, payment gateway
│   ├── contact-service/         # Contacts, groups, tags, CSV import
│   ├── template-service/        # WhatsApp message templates (all types), publishing
│   ├── campaign-service/        # Campaign creation, execution, retry, analytics
│   ├── chat-service/            # Real-time chat, chat assignment, message history
│   ├── whatsapp-service/        # Meta Cloud API integration, webhook handler, embedded signup
│   ├── automation-service/      # Basic reply automation, advanced flows, webhook/API setup
│   ├── organization-service/    # Orgs, team members, RBAC (user-level)
│   ├── notification-service/    # In-app + push + email notifications, admin broadcasts
│   ├── email-service/           # Transactional + marketing emails via SMTP
│   ├── support-service/         # Support tickets, query tracking, admin responses
│   ├── admin-service/           # Admin panel APIs, admin RBAC, sub-admin management
│   ├── analytics-service/       # Aggregated analytics for user dashboard + admin dashboard
│   └── media-service/           # File uploads, media management (Multer + local storage)
├── shared/                      # Shared libraries (published as local npm packages)
│   ├── shared-middleware/       # Auth middleware, RBAC middleware, error handler, tenant resolver
│   ├── shared-models/           # Sequelize model definitions (each service imports only what it needs)
│   ├── shared-utils/            # Helpers: encryption, pagination, response formatter, validators
│   ├── shared-config/           # DB config, Redis config, Kafka config, constants
│   └── shared-events/          # Kafka event schemas, topic definitions, producer/consumer helpers
├── frontend/                    # React SPA (Phase 2)
│   ├── src/
│   │   ├── modules/             # Feature-based modules (auth, dashboard, contacts, etc.)
│   │   ├── shared/              # Shared UI components, hooks, utils
│   │   └── core/                # App shell, routing, state, providers
│   └── ...
├── docker/                      # Docker configs
├── scripts/                     # DB seeds, migration runners, setup scripts
├── docs/                        # API docs, architecture decisions
│   ├── api/                     # OpenAPI/Swagger specs per service
│   ├── architecture/            # ADRs (Architecture Decision Records)
│   └── whatsapp-reference/      # Meta API reference extracted from whatomate
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── CLAUDE.md                    # This file
```

## Tech Stack

### Backend
- **Runtime:** Node.js 20.x LTS
- **Framework:** Express.js (separate app per service)
- **Database:** MySQL 8.0 (shared instance, separate schemas/table prefixes per service)
- **ORM:** Sequelize v6 with CLI migrations (NEVER sync)
- **Message Broker:** Apache Kafka (campaigns, emails, notifications, analytics events)
- **Cache:** Redis 7.x (sessions, caching, rate limit counters, pub/sub for Socket.IO)
- **Real-time:** Socket.IO with Redis adapter
- **Auth:** JWT (access + refresh tokens) + CSRF protection
- **OAuth:** Passport.js (Google, Facebook — admin configurable on/off)
- **Validation:** Zod on every route
- **Logging:** Winston (structured JSON) + Morgan (HTTP)
- **Security:** Helmet, express-rate-limit, bcrypt (cost 12+), AES-256 encryption
- **HTTP Client:** Axios (inter-service communication)
- **File Upload:** Multer (local storage, organized by tenant_id)
- **API Docs:** Swagger/OpenAPI auto-generated per service
- **Testing:** Jest + Supertest
- **Containers:** Docker + docker-compose

### WhatsApp Integration
- Meta WhatsApp Cloud API v20.0+
- Embedded Signup SDK (JavaScript)
- Webhook signature verification (X-Hub-Signature-256)
- All message types: text, image, video, document, audio, location, contact, interactive (buttons, lists), template, reaction, sticker
- Template types: standard, authentication, carousel, flow (form), list menu
- Flow Builder support for WhatsApp Flows

### Payment
- Razorpay (subscription + wallet recharge)

### Frontend (Phase 2)
- React 18+ with Vite
- shadcn/ui + Tailwind CSS + lucide-react
- React Query (server state) + Redux Toolkit (client state)
- React Router DOM v6
- React Hook Form + Zod
- Socket.IO Client
- Recharts (charts) + TanStack Table (data tables)
- react-i18next (i18n)
- Docker + Nginx (production)

## Database Design Conventions

- All tables prefixed with service name: `auth_users`, `contact_contacts`, `tmpl_templates`
- Every table has: `id` (UUID v4 primary key), `created_at`, `updated_at`, `deleted_at` (soft delete)
- Multi-tenant: every user-facing table has `user_id` (the tenant/account owner)
- Foreign keys reference `user_id` from `auth_users` table
- Indexes on: `user_id`, `created_at`, any field used in WHERE/ORDER BY
- Use ENUM for status fields with clear values
- Store JSON in `JSON` column type when schema is flexible (e.g., template components)
- Monetary values stored as integers (paise/cents), displayed as decimal on frontend

## API Conventions

```
Base URL: /api/v1/{service-prefix}/{resource}

Examples:
  POST   /api/v1/auth/register
  POST   /api/v1/auth/login
  GET    /api/v1/users/profile
  GET    /api/v1/contacts?page=1&limit=20&search=john&tag=vip
  POST   /api/v1/templates
  PUT    /api/v1/templates/:id
  DELETE /api/v1/templates/:id
  POST   /api/v1/campaigns/:id/start
  POST   /api/v1/campaigns/:id/retry

Admin routes:
  GET    /api/v1/admin/users?page=1&limit=20&search=&status=active
  POST   /api/v1/admin/users/:id/wallet/credit
  POST   /api/v1/admin/plans
```

### Standard Response Format
```json
// Success
{
  "success": true,
  "message": "Resource created successfully",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}

// Error
{
  "success": false,
  "message": "Validation failed",
  "errors": [ { "field": "email", "message": "Invalid email format" } ]
}
```

### Authentication Flow
1. Register → email verification → login
2. Login returns: `{ accessToken, refreshToken }` — access token in memory, refresh token in httpOnly cookie
3. Every request: `Authorization: Bearer <accessToken>`
4. API Gateway validates token, extracts `user_id`, `role`, `permissions` and forwards as headers
5. Services trust gateway-injected headers (internal network only)

### RBAC Model
```
User Level:
  - Owner (account holder) → full access
  - Team Member → permissions defined per resource (contacts, chat, finance, etc.) with CRUD flags

Admin Level:
  - Super Admin → full access
  - Sub Admin → permissions defined per resource (users, dashboard, support, etc.) with CRUD flags

Permission object example:
{
  "resources": {
    "contacts": { "create": true, "read": true, "update": true, "delete": false },
    "chat": { "create": true, "read": true, "update": false, "delete": false },
    "finance": { "create": false, "read": true, "update": false, "delete": false }
  }
}
```

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `campaign.execute` | campaign-service | whatsapp-service | Send campaign messages |
| `campaign.status` | whatsapp-service | campaign-service | Message delivery status |
| `campaign.analytics` | whatsapp-service | analytics-service | Message metrics |
| `notification.send` | any service | notification-service | Trigger notifications |
| `email.send` | any service | email-service | Trigger emails |
| `webhook.inbound` | whatsapp-service | chat-service, automation-service | Incoming WhatsApp events |
| `wallet.transaction` | wallet-service | analytics-service | Financial events |
| `user.events` | auth-service | analytics-service, notification-service | User lifecycle events |

## Inter-Service Communication

- **Synchronous:** Axios HTTP calls via internal Docker network (service-name:port)
- **Asynchronous:** Kafka for events that don't need immediate response
- **Real-time:** Redis pub/sub for Socket.IO across service instances

## Service Port Map

| Service | Port |
|---|---|
| api-gateway | 3000 |
| auth-service | 3001 |
| user-service | 3002 |
| subscription-service | 3003 |
| wallet-service | 3004 |
| contact-service | 3005 |
| template-service | 3006 |
| campaign-service | 3007 |
| chat-service | 3008 |
| whatsapp-service | 3009 |
| automation-service | 3010 |
| organization-service | 3011 |
| notification-service | 3012 |
| email-service | 3013 |
| support-service | 3014 |
| admin-service | 3015 |
| analytics-service | 3016 |
| media-service | 3017 |

## File Naming Conventions

```
services/{service-name}/
├── src/
│   ├── app.js                    # Express app setup (middleware, routes, error handler)
│   ├── server.js                 # HTTP server + graceful shutdown
│   ├── routes/
│   │   └── {resource}.routes.js  # e.g., contact.routes.js
│   ├── controllers/
│   │   └── {resource}.controller.js
│   ├── services/
│   │   └── {resource}.service.js # Business logic (controllers call services)
│   ├── validations/
│   │   └── {resource}.validation.js # Zod schemas
│   ├── models/
│   │   └── {Model}.model.js      # Sequelize model (PascalCase)
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS-create-{table}.js
│   ├── seeders/                  # Optional seed data
│   ├── middlewares/              # Service-specific middleware
│   ├── helpers/                  # Service-specific helpers
│   ├── kafka/
│   │   ├── producer.js
│   │   └── consumers/
│   │       └── {topic}.consumer.js
│   └── config/
│       └── index.js              # Service-specific config
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── Dockerfile
├── .env.example
└── .sequelizerc
```

## Development Commands

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Run migrations for a specific service
cd services/{service-name} && npx sequelize-cli db:migrate

# Run all migrations
./scripts/migrate-all.sh

# Create new migration
cd services/{service-name} && npx sequelize-cli migration:generate --name {name}

# Run tests
cd services/{service-name} && npm test

# Kafka topics setup
./scripts/setup-kafka-topics.sh
```

## Phase Execution Plan

### Phase 1: Foundation (Current)
- Project scaffold (all directories, package.jsons, docker-compose)
- Shared libraries (middleware, utils, config, events)
- API Gateway with routing config
- Database setup + migration infrastructure
- Docker development environment

### Phase 2: Core Auth & User Management
- Auth service (register, login, JWT, refresh, OAuth, email verification, password reset)
- User service (profile, settings, developer tools/API tokens)
- Organization service (create org, team members, user-level RBAC)

### Phase 3: Subscription & Finance
- Subscription service (plans, subscribe, upgrade, cancel, limit checks)
- Wallet service (recharge, debit, credit, transactions, invoices, Razorpay integration)

### Phase 4: WhatsApp Core
- WhatsApp service (Meta Cloud API, embedded signup, webhook handler, message sending)
- Contact service (CRUD, groups, tags, CSV import)
- Template service (all types: standard, auth, carousel, flow, list — create, publish, status)
- Media service (file upload, storage, retrieval)

### Phase 5: Campaigns & Chat
- Campaign service (create, schedule, execute via Kafka, retry, analytics)
- Chat service (real-time messaging, chat assignment, message history, Socket.IO)

### Phase 6: Automation & Integrations
- Automation service (basic auto-reply, advanced flows, webhook setup, API triggers)
- Notification service (in-app, email, push — Kafka consumer)
- Email service (SMTP, transactional, marketing emails)

### Phase 7: Admin Panel Backend
- Admin service (user management, sub-admin RBAC, dashboard analytics)
- Support service (tickets, query tracking, assignment, notifications)
- Analytics service (aggregated metrics for both user and admin dashboards)

### Phase 8: Frontend — User Dashboard
- Auth pages, dashboard, contacts, templates, campaigns, chat, settings, developer tools

### Phase 9: Frontend — Admin Dashboard  
- Admin login, user management, plans, support desk, analytics, settings, notifications, emails

### Phase 10: Testing, Optimization & Deployment
- Unit + integration tests per service
- Performance optimization
- Production Docker configs + Nginx
- CI/CD pipeline

## IMPORTANT NOTES FOR AI

1. **Read before write:** Before creating/modifying any file, ALWAYS read existing related files first
2. **One service at a time:** Complete one microservice fully before moving to the next
3. **Test the chain:** After creating a service, verify it connects to DB, Redis, Kafka
4. **Migration-first:** Create migration → run it → then create model matching the migration exactly
5. **No orphan code:** Every file must be imported/used somewhere
6. **Production patterns:** Use connection pooling, graceful shutdown, health checks, proper error classes
7. **Idempotent migrations:** Migrations must be safe to run multiple times
8. **Environment parity:** Code must work in both dev (docker-compose) and production

## WhatsApp API Reference Documents

Three critical reference documents exist in `docs/whatsapp-reference/`. These contain production-ready API payloads, webhook structures, and business logic extracted from Meta's official Postman collections and the whatomate open-source project.

**⚠️ MANDATORY: Read these BEFORE writing any WhatsApp-related code (Phase 4+).**

### `docs/whatsapp-reference/meta-api-patterns.md` (~800 lines)
**Complete Meta Cloud API endpoint reference.** Contains:
- Account setup: WABA subscription, phone registration, verification
- All 20+ message sending payloads: text, image, video, audio, document, sticker, location, contact, reaction, interactive buttons, list messages, single/multi product, catalog, WhatsApp Flows
- All template sending payloads: simple, with variables, with media header, with quick reply buttons, with flow buttons, with catalog buttons
- All template CRUD: create standard, auth OTP (copy code + one-tap autofill), image/document/location header, catalog, MPM, flow (by name/ID/inline JSON), edit, delete
- Embedded Signup: complete server-side flow (token exchange → WABA discovery → phone numbers → subscribe)
- Media: upload, get URL, download
- Business profile, QR codes, webhook subscription management

**Read when building:** whatsapp-service, template-service, media-service

### `docs/whatsapp-reference/template-structures.md` (~680 lines)
**Deep-dive into every template type's component structure.** Contains:
- All template categories (MARKETING, UTILITY, AUTHENTICATION) with rules
- Component types: HEADER (text/image/video/document/location), BODY, FOOTER, BUTTONS
- Complete create + send JSON for every template type: standard text, image header, video header, document header, location header, auth OTP copy code, auth OTP one-tap autofill, catalog, multi-product (MPM), flow (by name/ID/inline JSON)
- Body parameter types: text, currency (with amount_1000), date_time
- Button type reference table with limits per template
- Template status lifecycle: PENDING → APPROVED → PAUSED → DISABLED flow
- Template status webhook payload
- Suggested database schema for wa_templates table

**Read when building:** template-service (this is the PRIMARY reference), campaign-service (sending templates)

### `docs/whatsapp-reference/webhook-events.md` (~400 lines)
**Every webhook payload structure with handler routing logic.** Contains:
- Webhook verification (GET challenge-response)
- Signature verification (X-Hub-Signature-256) with Node.js code
- Common webhook envelope parsing logic
- All inbound message types: text, image, sticker, audio, video, document, location, contact, reaction, button reply, list reply, interactive reply, order, product enquiry, ad referral, unknown
- All status updates: sent, delivered, read, failed (with pricing/conversation objects)
- Business management events: template status (approved/rejected), phone quality update, account ban/restrict
- Complete Nyife handler routing logic: parse → identify type → route to correct Kafka topic

**Read when building:** whatsapp-service (webhook handler), chat-service (message types), campaign-service (status tracking)

### `docs/whatsapp-reference/business-logic.md` (~300 lines)
**Architecture patterns adapted from whatomate for Nyife's microservices.** Contains:
- Campaign execution flow: validation → contact resolution → Kafka batching → sending → status tracking → real-time updates. Includes rate limiting strategy and retry logic with exponential backoff.
- Real-time chat architecture: inbound/outbound message flows, Socket.IO room management, conversation state
- Template variable resolution: mapping `{{1}}` placeholders to contact fields with nested path support
- Chatbot/automation matching: priority-based keyword matching (exact/contains/regex), flow state tracking in Redis
- Contact CSV import pipeline: parse, validate E.164, deduplicate, bulk insert, async for large files
- Embedded signup server-side flow: step-by-step token exchange to account creation
- Message pricing calculation: per-category cost from subscription plan
- Whatomate → Nyife service mapping table
- Features Nyife adds beyond whatomate (SaaS billing, admin panel, support, etc.)

**Read when building:** campaign-service, chat-service, automation-service, contact-service

### Usage Rules:
1. These are **reference patterns** — implement in Node.js/Express, NOT Go
2. All JSON payloads are **production-ready** — use them directly in Axios calls to Meta API
3. The webhook handler logic is a **blueprint** — implement it in whatsapp-service's webhook controller
4. Do NOT read all 3 files at once — read only what's relevant to the current service being built