# Nyife — WhatsApp Marketing SaaS Platform

Multi-tenant WhatsApp Marketing SaaS platform built with Node.js microservices. Businesses can manage WhatsApp Business accounts, send campaigns, chat with customers, create automations, and manage teams — all through a subscription-based model.

## Tech Stack

- **Runtime:** Node.js 20.x LTS
- **Framework:** Express.js (17 microservices + API Gateway)
- **Database:** MySQL 8.0 (Sequelize ORM with CLI migrations)
- **Cache:** Redis 7.x (ioredis)
- **Message Broker:** Apache Kafka
- **Real-time:** Socket.IO with Redis adapter
- **Auth:** JWT (access + refresh tokens) + CSRF protection
- **Validation:** Zod on every route
- **WhatsApp:** Meta Cloud API v20.0+ with Embedded Signup
- **Payments:** Razorpay (subscriptions + wallet recharge)
- **Frontend:** React 18, Vite, shadcn/ui, Tailwind CSS, Redux Toolkit, React Query
- **Containers:** Docker + docker-compose + Nginx

## Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- Git

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url> nyife
cd nyife
cp .env.example .env
# Edit .env with your values (DB credentials, JWT secrets, Razorpay keys, etc.)
npm install
```

### 2. Start with Docker (production)

```bash
# Build and start all 18 services + infrastructure
docker-compose up -d --build

# Services are behind Nginx reverse proxy:
# API:       http://localhost/api/v1/...
# Frontend:  http://localhost/
# WebSocket: http://localhost/socket.io/
# API Docs:  http://localhost/api-docs
```

### 3. Start for development

```bash
# Start the full backend dev stack with one command
docker compose -f docker-compose.dev.yml up -d --build

# Or use the root shortcut
npm run stack:up:build

# Run all migrations
npm run migrate:all


# Seed local test user and admin accounts
# Requires AUTH_TEST_PASSWORD in .env
(cd services/auth-service && npx sequelize-cli db:seed --seed src/seeders/20260309120000-seed-auth-manual-test-accounts.js)
(cd services/admin-service && npx sequelize-cli db:seed --seed src/seeders/20240101000001-seed-admin-defaults.js)

# Optional: create Kafka topics explicitly
npm run kafka:setup

# Start the frontend separately
cd frontend && npm run dev
```


Stop any locally running services on ports `3000-3017`, `3307`, `6379`, `9092`, or `2181` before starting the Docker dev stack.

Command reference: [docs/DEV_COMMANDS.md](/c:/Users/mdsah/OneDrive/Desktop/nyife/docs/DEV_COMMANDS.md)

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"api-gateway","timestamp":"...","uptime":...}
```

## API Documentation

Swagger UI is available at `/api-docs` on the API gateway:

```
http://localhost:3000/api-docs
```

Covers all major endpoints: auth, subscriptions, wallet, campaigns, automations, contacts, templates.

### API Conventions

- Base URL: `/api/v1/{service-prefix}/{resource}`
- Auth: `Authorization: Bearer <accessToken>`
- Standard response: `{ success, message, data, meta }`
- Pagination: `?page=1&limit=20`
- Soft deletes on all resources

## Project Structure

```
nyife/
├── services/              # Backend microservices
│   ├── api-gateway/       # Entry point — routing, rate limiting, auth, Swagger
│   ├── auth-service/      # Authentication, JWT, OAuth, email verification
│   ├── user-service/      # User profiles, settings, developer API tokens
│   ├── subscription-service/  # Plans, subscriptions, usage limits, coupons
│   ├── wallet-service/    # Wallet, transactions, invoices, Razorpay
│   ├── contact-service/   # Contacts, groups, tags, CSV import
│   ├── template-service/  # WhatsApp message templates (all types)
│   ├── campaign-service/  # Campaign creation, execution, retry
│   ├── chat-service/      # Real-time messaging, Socket.IO
│   ├── whatsapp-service/  # Meta Cloud API, webhooks, embedded signup
│   ├── automation-service/  # Auto-reply, advanced flows, webhook triggers
│   ├── organization-service/  # Orgs, team members, user-level RBAC
│   ├── notification-service/  # In-app, push, email notifications
│   ├── email-service/     # Transactional + marketing emails via SMTP
│   ├── support-service/   # Support tickets, query tracking
│   ├── admin-service/     # Admin panel APIs, sub-admin RBAC
│   ├── analytics-service/ # Aggregated metrics for user + admin dashboards
│   └── media-service/     # File uploads, media management
├── shared/                # Shared libraries
│   ├── shared-config/     # DB, Redis, Kafka config + constants
│   ├── shared-middleware/  # Auth, RBAC, error handler, tenant resolver
│   ├── shared-utils/      # AppError, response formatter, pagination, encryption
│   └── shared-events/     # Kafka topics, schemas, producer/consumer
├── frontend/              # React SPA (Vite + shadcn/ui + Tailwind)
├── docker/                # Nginx config
│   └── nginx/nginx.conf   # Reverse proxy, rate limiting, security headers
├── scripts/               # Migration runners, test scripts
└── docs/                  # API docs, architecture decisions, WhatsApp reference
```

## Service Port Map

| Service | Port | Description |
|---|---|---|
| api-gateway | 3000 | Routing, rate limiting, auth verification, Swagger |
| auth-service | 3001 | JWT auth, OAuth, email verification, password reset |
| user-service | 3002 | User profiles, settings, developer API tokens |
| subscription-service | 3003 | Plans, subscriptions, usage limits |
| wallet-service | 3004 | Wallet, transactions, invoices, Razorpay |
| contact-service | 3005 | Contacts, groups, tags, CSV import |
| template-service | 3006 | WhatsApp message templates |
| campaign-service | 3007 | Campaign creation, execution, retry |
| chat-service | 3008 | Real-time messaging, Socket.IO |
| whatsapp-service | 3009 | Meta Cloud API, webhooks |
| automation-service | 3010 | Auto-reply, flows, webhook triggers |
| organization-service | 3011 | Orgs, team members, RBAC |
| notification-service | 3012 | In-app + push + email notifications |
| email-service | 3013 | Transactional + marketing emails |
| support-service | 3014 | Support tickets |
| admin-service | 3015 | Admin panel APIs, sub-admin management |
| analytics-service | 3016 | User + admin dashboard metrics |
| media-service | 3017 | File uploads, media management |

## Database

All schema changes use Sequelize CLI migrations — **never `sequelize.sync()`**.

```bash
# Run all migrations
npm run migrate:all

# Run for a specific service
npm run migrate -- {service-name}

# Create a new migration
cd services/{service-name} && npx sequelize-cli migration:generate --name {name}
```

Conventions:
- Tables prefixed with service name: `auth_users`, `contact_contacts`, `tmpl_templates`
- Every table has: `id` (UUID v4), `created_at`, `updated_at`, `deleted_at` (soft delete)
- Multi-tenant: every user-facing table has `user_id`
- Monetary values stored as integers (paise)

### Seed test logins

Add this to `.env` before running the auth seeder:

```bash
AUTH_TEST_PASSWORD=Test123!@#
```

Run the local testing seeds from the repo root:

```bash
(cd services/auth-service && npx sequelize-cli db:seed --seed src/seeders/20260309120000-seed-auth-manual-test-accounts.js)
(cd services/admin-service && npx sequelize-cli db:seed --seed src/seeders/20240101000001-seed-admin-defaults.js)
```

Seeded logins:
- `user.test@example.com` / `Test123!@#`
- `admin.test@example.com` / `Test123!@#`

## Testing

```bash
# Run all tests (5 priority services: auth, wallet, subscription, campaign, automation)
bash scripts/test-all.sh

# Run tests for a specific service
cd services/{service-name} && npm test

# Run with coverage
cd services/{service-name} && npx jest --coverage
```

Test coverage includes:
- **Unit tests:** Service layer business logic (45+ tests per service)
- **Integration tests:** Full HTTP route testing with Supertest (12-17 tests per service)

## Docker Production

The production `docker-compose.yml` includes all 22 containers:
- 18 microservices + frontend
- MySQL, Redis, Zookeeper, Kafka
- Nginx reverse proxy with gzip, rate limiting, security headers, WebSocket support

```bash
docker-compose up -d --build
```

Each service has a 256MB memory limit. Nginx handles SSL termination, static asset caching, and request routing.

## Scripts

```bash
npm run stack:up            # Start backend stack
npm run stack:up:build      # Build and start backend stack
npm run stack:stop          # Stop all running stack containers
npm run stack:down          # Remove stack containers
npm run stack:restart       # Restart all stack containers
npm run stack:ps            # List stack containers
npm run service:start -- auth-service   # Start one service
npm run service:restart -- auth-service # Restart one service
npm run migrate:all         # Run all service migrations
npm run kafka:setup         # Create Kafka topics
bash scripts/test-all.sh    # Run all test suites
```

## Environment Variables

See `.env.example` for the full list. Key variables:

- `MYSQL_*` — Database connection
- `REDIS_*` — Redis connection
- `KAFKA_BROKERS` — Kafka broker addresses
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — Auth tokens
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Payment gateway
- `META_*` — WhatsApp Cloud API credentials
- `SMTP_*` — Email service configuration

## License

UNLICENSED
