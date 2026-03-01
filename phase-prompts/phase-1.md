# Phase 1: Foundation — Project Scaffold + Shared Libraries + API Gateway + Docker

Read CLAUDE.md first. This is Phase 1 of the Nyife project.

## Objective
Create the complete project scaffold, all shared libraries, the API Gateway service, Docker development environment, and database infrastructure. Everything in this phase must be production-grade and fully functional — no stubs.

## Tasks (execute in order):

### 1.1 — Project Root Setup
- Create root `package.json` (workspaces pointing to `services/*` and `shared/*`)
- Create root `.env.example` with all required environment variables:
  - DB: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
  - Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
  - Kafka: `KAFKA_BROKERS`
  - JWT: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRY`, `JWT_REFRESH_EXPIRY`
  - App: `NODE_ENV`, `API_GATEWAY_PORT`
  - Meta: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_API_VERSION`
  - Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
  - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Create `.gitignore` (node_modules, .env, logs, uploads, dist)
- Create root `README.md` with setup instructions

### 1.2 — Shared Libraries
Create these under `shared/`:

**shared-config/**: (`shared/shared-config/`)
- `src/database.js` — Sequelize connection factory (takes service name, returns configured Sequelize instance with connection pool: min 2, max 10)
- `src/redis.js` — Redis client factory (uses ioredis, takes namespace prefix)
- `src/kafka.js` — KafkaJS client factory (producer + consumer group factory)
- `src/constants.js` — App-wide constants (user roles, statuses, message types, template types, plan types, etc.)
- `src/index.js` — Barrel export
- `package.json`

**shared-middleware/**: (`shared/shared-middleware/`)
- `src/authMiddleware.js` — Verifies JWT from Authorization header, extracts user payload, attaches to `req.user`. Supports both user and admin tokens.
- `src/rbacMiddleware.js` — Takes required resource + permission (e.g., `rbac('contacts', 'create')`), checks against `req.user.permissions`. Returns 403 if denied.
- `src/tenantMiddleware.js` — Extracts `user_id` (tenant) from authenticated request, attaches to `req.tenantId` for multi-tenant queries.
- `src/errorHandler.js` — Global Express error handler. Catches all errors, formats consistent error response. Handles Zod validation errors, Sequelize errors, custom AppError class.
- `src/asyncHandler.js` — Wraps async route handlers to catch promise rejections.
- `src/rateLimiter.js` — Configurable rate limiter factory using express-rate-limit + Redis store.
- `src/requestLogger.js` — Morgan middleware configured for structured JSON logging.
- `src/index.js` — Barrel export
- `package.json`

**shared-utils/**: (`shared/shared-utils/`)
- `src/AppError.js` — Custom error class with statusCode, message, errors array, isOperational flag.
- `src/responseFormatter.js` — `successResponse(res, data, message, statusCode)` and `errorResponse(res, message, errors, statusCode)` functions.
- `src/pagination.js` — `getPagination(page, limit)` → returns `{ offset, limit }`. `getPaginationMeta(total, page, limit)` → returns `{ page, limit, total, totalPages }`.
- `src/encryption.js` — AES-256-CBC encrypt/decrypt functions for sensitive data (API tokens, WhatsApp tokens).
- `src/validators.js` — Common Zod schemas: `phoneSchema`, `emailSchema`, `uuidSchema`, `paginationSchema`, `dateRangeSchema`.
- `src/helpers.js` — `generateUUID()`, `generateApiToken()`, `slugify()`, `sanitizeHtml()`, `formatCurrency(amountInPaise)`.
- `src/index.js` — Barrel export
- `package.json`

**shared-events/**: (`shared/shared-events/`)
- `src/topics.js` — All Kafka topic name constants (from CLAUDE.md topic table)
- `src/schemas.js` — Zod schemas for every Kafka event payload
- `src/producer.js` — `publishEvent(topic, key, payload)` — validates payload against schema, publishes to Kafka
- `src/consumer.js` — `createConsumer(groupId, topic, handler)` — creates consumer, subscribes, runs handler with parsed+validated payload
- `src/index.js` — Barrel export
- `package.json`

### 1.3 — API Gateway Service
Create `services/api-gateway/`:
- Full Express app with:
  - Helmet security headers
  - CORS configuration (configurable origins)
  - Morgan request logging
  - Rate limiting (global: 100 req/min, auth routes: 10 req/min)
  - Health check endpoint: `GET /health`
  - Proxy routing to all backend services (use `http-proxy-middleware`)
  - Route configuration map: maps public URL paths → internal service URLs
  - JWT verification on protected routes (calls shared auth middleware)
  - Injects `x-user-id`, `x-user-role`, `x-user-permissions` headers for downstream services
  - Swagger UI at `/api/docs` (aggregated)
  - Global error handler
  - Graceful shutdown (close server, disconnect Redis)
- `package.json` with all dependencies
- `Dockerfile` (Node 20 Alpine, multi-stage build)
- `.env.example`

### 1.4 — Docker Development Environment
Create at project root:

**docker-compose.dev.yml:**
- `mysql` — MySQL 8.0, port 3306, volume for persistence, init script to create database
- `redis` — Redis 7 Alpine, port 6379
- `zookeeper` — For Kafka
- `kafka` — KafkaJS compatible, port 9092, auto-create topics enabled
- `api-gateway` — Build from services/api-gateway, port 3000, depends on mysql, redis, kafka
- Shared network: `nyife-network`
- Volume mounts for hot-reload in development

**docker-compose.yml** (production skeleton — basic structure, will be completed in Phase 10)

### 1.5 — Database Migration Infrastructure
- Create `scripts/migrate-all.sh` — Loops through all services with migrations, runs `npx sequelize-cli db:migrate` for each
- Create `scripts/setup-kafka-topics.sh` — Creates all Kafka topics from the topic list
- Each service's `.sequelizerc` must point to correct paths

### 1.6 — Verify Everything Works
- The gateway should start and respond to `GET /health` with `{"status":"ok","service":"api-gateway"}`
- `docker-compose -f docker-compose.dev.yml up` should bring up MySQL, Redis, Kafka, and gateway
- Shared libraries should be importable by any service

## Completion Criteria
- [ ] All directories created per CLAUDE.md architecture
- [ ] All shared libraries fully implemented (no stubs)
- [ ] API Gateway starts and proxies requests
- [ ] Docker dev environment starts all infrastructure
- [ ] Migration scripts are executable
- [ ] Every file has proper exports and is connected
