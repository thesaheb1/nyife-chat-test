# Dev Commands

This project now supports a single Docker command for the full backend dev stack:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Before running it, stop any locally running services already using ports `3000-3017`, `3307`, `6379`, `9092`, or `2181`.

That command starts:

- MySQL
- Redis
- Zookeeper
- Kafka
- API Gateway
- All 17 backend microservices

If you prefer npm shortcuts, use the root scripts below.

## Full Stack

```bash
npm run stack:up
npm run stack:up:build
npm run stack:stop
npm run stack:down
npm run stack:restart
npm run stack:ps
npm run stack:logs
```

## Infrastructure Only

```bash
npm run infra:up
npm run infra:stop
npm run infra:down
npm run infra:restart
```

## Single Service

Pass the service name after `--`.

```bash
npm run service:start -- auth-service
npm run service:stop -- auth-service
npm run service:restart -- auth-service
npm run service:logs -- auth-service
```

Allowed service names:

```text
mysql
redis
zookeeper
kafka
api-gateway
auth-service
user-service
subscription-service
wallet-service
contact-service
template-service
campaign-service
chat-service
whatsapp-service
automation-service
organization-service
notification-service
email-service
support-service
admin-service
analytics-service
media-service
```

## Database Migrations

Run all service migrations:

```bash
npm run migrate:all
```

Run a single service migration:

```bash
npm run migrate -- auth-service
```

Undo the latest migration for one service:

```bash
npm run migrate:undo -- auth-service
```

Check migration status for one service:

```bash
npm run migrate:status -- auth-service
```

## Kafka Topics

```bash
npm run kafka:setup
```

## Frontend

The dev Docker stack is backend-only. Run the frontend separately:

```bash
cd frontend
npm run dev
```

Frontend dev now runs behind local HTTPS so Meta Embedded Signup can open correctly.
Open:

```text
https://localhost:5173
```

Notes:

- The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:3000`, so backend requests still work locally.
- Your browser may show a local-certificate warning the first time. Accept the warning for `https://localhost:5173` before testing Meta login.

## Ports

```text
3000  api-gateway
3001  auth-service
3002  user-service
3003  subscription-service
3004  wallet-service
3005  contact-service
3006  template-service
3007  campaign-service
3008  chat-service
3009  whatsapp-service
3010  automation-service
3011  organization-service
3012  notification-service
3013  email-service
3014  support-service
3015  admin-service
3016  analytics-service
3017  media-service
3307  mysql host port
6379  redis
9092  kafka
2181  zookeeper
```
