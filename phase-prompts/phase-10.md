# Phase 10: Testing, Optimization & Deployment

Read CLAUDE.md. This is the final phase. All services and frontend are complete.

---

## Task 10.1 — Unit Tests (Jest)

For each service, create tests in `services/{service}/tests/unit/`:
- Test all service layer functions (business logic)
- Test all validation schemas (valid + invalid inputs)
- Test helper/utility functions
- Mock: database, Redis, Kafka, external APIs (Meta, Razorpay)
- Target: 80%+ code coverage on service layer

Priority services to test (most critical business logic):
1. wallet-service (atomic debits, balance checks)
2. subscription-service (limit checks, coupon validation, expiry logic)
3. campaign-service (execution flow, retry logic)
4. auth-service (JWT generation, password hashing, token rotation)
5. automation-service (matching logic, flow execution)

## Task 10.2 — Integration Tests (Supertest)

For each service, create tests in `services/{service}/tests/integration/`:
- Test full HTTP request → response cycle
- Test with real DB (use separate test database)
- Test auth flows end-to-end
- Test inter-service calls
- Test Kafka producer/consumer integration
- Test error handling (invalid input, unauthorized, not found, etc.)

Create `scripts/test-all.sh` — runs tests for all services with coverage report.

## Task 10.3 — Production Docker Configuration

Update each service's Dockerfile for production:
- Multi-stage build: `node:20-alpine` for build, `node:20-alpine` for runtime
- Only copy production dependencies
- Run as non-root user
- Health check instruction

Create production `docker-compose.yml`:
- All services with production configs
- MySQL with proper resource limits
- Redis with persistence (AOF)
- Kafka with proper replication
- Nginx reverse proxy for frontend + API gateway
- Volume management for uploads, logs, DB data
- Environment variable management
- Restart policies: `unless-stopped`

Create `docker/nginx/nginx.conf`:
- Frontend: serve static files, SPA fallback
- API proxy: `/api/*` → api-gateway:3000
- WebSocket proxy: `/socket.io/*` → chat-service:3008
- SSL termination ready (Let's Encrypt placeholder)
- Gzip compression
- Static file caching headers
- Security headers

## Task 10.4 — Performance Optimization

Backend:
- Add Redis caching to frequently read endpoints (dashboard stats, plan list, settings)
- Add cache invalidation on writes
- Database query optimization: verify indexes on all filtered/sorted columns
- Connection pooling review (Sequelize pool settings)
- Kafka consumer tuning (batch size, concurrent processing)

Frontend:
- Code splitting: lazy-load each module route
- React.memo on expensive components
- Virtualized lists for large tables (react-virtual)
- Image optimization (lazy loading)
- Bundle analysis and tree-shaking verification
- Service worker for offline-capable (optional)

## Task 10.5 — Documentation

- Generate Swagger/OpenAPI docs for every service
- Create `docs/api/` with aggregated API documentation
- Update root `README.md` with:
  - Project overview
  - Architecture diagram (text-based)
  - Setup instructions (dev + production)
  - Environment variables reference
  - Deployment guide
  - Contributing guidelines

## Task 10.6 — Security Audit Checklist

Verify:
- [ ] All passwords hashed with bcrypt (cost 12+)
- [ ] All sensitive data encrypted at rest (AES-256)
- [ ] JWT tokens have appropriate expiry
- [ ] Refresh token rotation implemented
- [ ] CSRF protection on state-changing requests
- [ ] Helmet on every service
- [ ] Rate limiting on auth routes, webhooks, API endpoints
- [ ] Input validation on every route (Zod)
- [ ] SQL injection prevention (parameterized queries via Sequelize)
- [ ] XSS prevention (sanitized outputs)
- [ ] CORS properly configured (specific origins, not *)
- [ ] Webhook signature verification (Meta, Razorpay)
- [ ] File upload validation (type, size, content)
- [ ] No secrets in code or logs
- [ ] Proper error messages (no stack traces in production)

## Completion Criteria
- [ ] 80%+ test coverage on critical services
- [ ] Integration tests pass for all services
- [ ] Production docker-compose starts all services
- [ ] Nginx serves frontend and proxies API correctly
- [ ] Performance optimizations applied
- [ ] API documentation generated
- [ ] Security checklist passed
- [ ] Full README with setup and deployment instructions
