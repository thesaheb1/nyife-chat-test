# Nyife — WhatsApp Marketing SaaS Platform

Multi-tenant WhatsApp Marketing SaaS platform built with Node.js microservices architecture.

## Tech Stack

- **Runtime:** Node.js 20.x LTS
- **Framework:** Express.js (17 microservices + API Gateway)
- **Database:** MySQL 8.0 (Sequelize ORM with migrations)
- **Cache:** Redis 7.x (ioredis)
- **Message Broker:** Apache Kafka
- **Real-time:** Socket.IO with Redis adapter
- **Auth:** JWT (access + refresh tokens)
- **Validation:** Zod
- **Containerization:** Docker + docker-compose

## Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- Git

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> nyife
cd nyife
cp .env.example .env
# Edit .env with your values
npm install
```

### 2. Start infrastructure with Docker

```bash
docker-compose -f docker-compose.dev.yml up -d mysql redis zookeeper kafka
```

### 3. Run migrations

```bash
bash scripts/migrate-all.sh
```

### 4. Setup Kafka topics

```bash
docker exec nyife-kafka bash -c "$(cat scripts/setup-kafka-topics.sh)"
```

### 5. Start the API Gateway

```bash
cd services/api-gateway
npm run dev
```

The gateway will be available at `http://localhost:3000`.

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"api-gateway","timestamp":"...","uptime":...}
```

## Project Structure

```
nyife/
├── services/              # Backend microservices
│   ├── api-gateway/       # Entry point — routing, rate limiting, auth
│   ├── auth-service/      # Authentication, JWT, OAuth
│   ├── user-service/      # User profiles, settings
│   ├── subscription-service/
│   ├── wallet-service/
│   ├── contact-service/
│   ├── template-service/
│   ├── campaign-service/
│   ├── chat-service/
│   ├── whatsapp-service/
│   ├── automation-service/
│   ├── organization-service/
│   ├── notification-service/
│   ├── email-service/
│   ├── support-service/
│   ├── admin-service/
│   ├── analytics-service/
│   └── media-service/
├── shared/                # Shared libraries
│   ├── shared-config/     # DB, Redis, Kafka factories + constants
│   ├── shared-middleware/  # Auth, RBAC, error handler, rate limiter
│   ├── shared-utils/      # AppError, response formatter, pagination, encryption
│   └── shared-events/     # Kafka topics, schemas, producer/consumer
├── docker/                # Docker configuration files
├── scripts/               # Migration and setup scripts
└── docs/                  # API and architecture documentation
```

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

## Scripts

```bash
npm run docker:dev          # Start dev environment
npm run docker:dev:build    # Build and start dev environment
npm run docker:dev:down     # Stop dev environment
npm run migrate:all         # Run all service migrations
npm run kafka:setup         # Create Kafka topics
```

## License

UNLICENSED
