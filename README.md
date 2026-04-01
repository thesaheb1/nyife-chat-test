# Nyife

Nyife is a multi-tenant WhatsApp marketing SaaS platform built as a Node.js microservice system with a React frontend. It supports organizations, team access, campaigns, contacts, automations, support, billing, and a separate admin panel.

## Project Specification

- Architecture: 17 backend microservices behind an API gateway, plus a Vite frontend
- Runtime: Node.js 20+
- Backend framework: Express.js
- Frontend: React 18, Vite, Tailwind CSS, shadcn/ui
- Database: MySQL 8 with Sequelize CLI migrations
- Cache: Redis
- Messaging: Kafka
- Container runtime: Docker Compose
- Auth model: JWT access/refresh tokens, email verification, CSRF protection
- Tenancy model: organizations isolate user-panel data

## Account Pattern

Nyife uses `auth-service` as the identity source of truth. Every login account lives in `auth_users`.

### User panel accounts

- `user`: primary customer account
- `team`: invited team member account inside an organization
- `organization-service`: owns organizations, memberships, invitations, and active-organization state
- `user-service`: owns user profile/settings and user-facing account data outside raw authentication

### Admin panel accounts

- `super_admin`: full admin access driven only by `auth_users.role = 'super_admin'`
- `admin`: sub-admin login in `auth_users` plus an `admin_sub_admins` record in `admin-service`
- `admin-service`: owns admin roles, admin settings, sub-admin assignments, and admin invitations

### Service relation summary

- `auth-service` decides who can log in
- `organization-service` decides what a user or team member can access in the user panel
- `admin-service` decides what a non-super-admin can access in the admin panel

Because of that relationship, a seeded `super_admin` account is the safest way to guarantee admin login after a clean reset.

## Services

| Service | Port | Responsibility |
| --- | --- | --- |
| `api-gateway` | `3000` | API entrypoint, auth verification, routing, Swagger |
| `auth-service` | `3001` | registration, login, refresh tokens, email verification, OAuth |
| `user-service` | `3002` | user profile, settings, developer/account data |
| `subscription-service` | `3003` | plans, subscriptions, limits, coupons |
| `wallet-service` | `3004` | wallet, ledger, invoices, payments |
| `contact-service` | `3005` | contacts, groups, tags, imports |
| `template-service` | `3006` | WhatsApp templates |
| `campaign-service` | `3007` | campaigns and delivery flow |
| `chat-service` | `3008` | realtime chat |
| `whatsapp-service` | `3009` | Meta/WhatsApp integration |
| `automation-service` | `3010` | flows, webhooks, automations |
| `organization-service` | `3011` | organizations, memberships, invitations |
| `notification-service` | `3012` | notifications |
| `email-service` | `3013` | transactional and system emails |
| `support-service` | `3014` | support tickets |
| `admin-service` | `3015` | admin RBAC, admin settings, sub-admin management |
| `analytics-service` | `3016` | admin/user reporting |
| `media-service` | `3017` | uploads and media storage |

Local infrastructure services:

- MySQL
- Redis
- Zookeeper
- Kafka

## Prerequisites

- Node.js 20 or newer
- npm
- Docker and Docker Compose

## Local Development Setup

### 1. Install dependencies

```bash
npm install
cd frontend && npm install
cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Review `.env` before startup. Important values include:

- `MYSQL_*`
- `REDIS_*`
- `KAFKA_BROKERS`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `EMAIL_SERVICE_URL`
- `FRONTEND_URL`

Optional admin seed overrides:

- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_FIRST_NAME`
- `ADMIN_SEED_LAST_NAME`
- `ADMIN_SEED_PHONE`

If these are not provided, the admin seed uses:

- Email: `admin@nyife.com`
- Password: `Admin123!@#`
- Name: `Super Admin`

### 3. Start the backend stack

```bash
npm run stack:up:build
```

This starts the development Docker stack from `docker-compose.dev.yml`.

### 4. Run all migrations

```bash
npm run migrate:all
```

### 5. Seed admin defaults

```bash
npm run seed:admin:defaults
```

This seeds:

- the system `Super Admin` role in `admin_roles`
- default records in `admin_settings`

The seed is safe to rerun and only inserts missing records.

### 6. Seed the admin login account

```bash
npm run seed:admin
```

This creates or refreshes a `super_admin` login in `auth_users`.

Behavior:

- creates the account when it does not exist
- updates the password/profile when the same seeded `super_admin` already exists
- restores the account if it was soft-deleted
- refuses to overwrite a normal `user`, `team`, or `admin` account with the same email

### 7. Optional Kafka topic setup

```bash
npm run kafka:setup
```

### 8. Start the frontend

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`

## Fresh Reset Checklist

If you deleted containers, images, or volumes and want a full local reset:


```bash
npm install
npm run stack:up:build
npm run migrate:all
npm run seed:admin:defaults
npm run seed:admin
npm run kafka:setup
cd frontend && npm run dev
```

## Local Admin Login

Default seeded admin credentials:

- Email: `admin@nyife.com`
- Password: `Admin123!@#`

If you set `ADMIN_SEED_*` values in `.env`, those values are used instead.

## Commands

### Stack control

```bash
npm run stack:up
npm run stack:up:build
npm run stack:stop
npm run stack:down
npm run stack:restart
npm run stack:ps
npm run stack:logs
npm run stack:logs -- auth-service
```

### Individual service/container control

Use the repo helper scripts when you want to manage just one container from the development stack in `docker-compose.dev.yml`.

Examples:   

```bash
npm run service:start -- whatsapp-service
npm run service:stop -- whatsapp-service
npm run service:restart -- whatsapp-service

npm run service:start -- chat-service
npm run service:stop -- chat-service
npm run service:restart -- chat-service
```

If you changed Dockerfile or dependency setup for a single service, rebuild that service while starting or restarting it:

```bash
npm run service:start -- whatsapp-service --build
npm run service:restart -- chat-service --build
npm run service:restart -- template-service --build
npm run service:restart -- admin-service --build
npm run service:restart -- campaign-service --build
npm run service:restart -- contact-service --build
npm run service:restart -- email-service --build
npm run service:restart -- media-service --build
npm run service:restart -- notification-service --build
npm run service:restart -- organization-service --build
npm run service:restart -- subscription-service --build
npm run service:restart -- support-service --build
npm run service:restart -- wallet-service --build
npm run service:restart -- whatsapp-service --build



```

Raw Docker Compose equivalents:

```bash
docker compose -f docker-compose.dev.yml up -d whatsapp-service
docker compose -f docker-compose.dev.yml stop whatsapp-service
docker compose -f docker-compose.dev.yml restart whatsapp-service

docker compose -f docker-compose.dev.yml up -d chat-service
docker compose -f docker-compose.dev.yml stop chat-service
docker compose -f docker-compose.dev.yml restart chat-service
```

### Migrations

```bash
npm run migrate:all
npm run migrate -- auth-service
npm run migrate:undo -- auth-service
npm run migrate:status -- auth-service
```

### Seeds

```bash
npm run seed:admin:defaults
npm run seed:admin
```

Service-local equivalents:

```bash
cd services/admin-service
npx sequelize-cli db:seed:all

cd ../auth-service
npx sequelize-cli db:seed --seed src/seeders/20260318000000-seed-admin-account.js
```

## Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3015/health
```

## Project Structure

```text
nyife/
├── frontend/
├── services/
│   ├── api-gateway/
│   ├── admin-service/
│   ├── analytics-service/
│   ├── auth-service/
│   ├── automation-service/
│   ├── campaign-service/
│   ├── chat-service/
│   ├── contact-service/
│   ├── email-service/
│   ├── media-service/
│   ├── notification-service/
│   ├── organization-service/
│   ├── subscription-service/
│   ├── support-service/
│   ├── template-service/
│   ├── user-service/
│   ├── wallet-service/
│   └── whatsapp-service/
├── shared/
│   ├── shared-config/
│   ├── shared-events/
│   ├── shared-middleware/
│   └── shared-utils/
├── docker/
├── scripts/
├── docker-compose.dev.yml
├── docker-compose.yml
└── README.md
```

## Notes

- The seeded admin account is for development and recovery after a reset.
- Do not use the default seed password in production.
- For a fully usable admin panel after a fresh reset, run both `npm run seed:admin:defaults` and `npm run seed:admin`.


