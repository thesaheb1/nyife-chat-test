# WHATOMATE_EXTRACTION_GUIDE.md — Complete Reference Strategy for Nyife

## ❌ DO NOT: Feed entire whatomate codebase to Claude Code

**Why it's disastrous:**
1. Whatomate is monolithic Go + Vue.js — Claude will unconsciously replicate monolithic patterns
2. Massive codebase burns 80%+ of context window on irrelevant code
3. Go patterns don't translate to Node.js idioms — causes confused hybrid code
4. Vue.js components are useless for React frontend
5. Claude starts hallucinating merge patterns between two incompatible architectures
6. Whatomate is NOT SaaS — has no subscriptions, wallets, multi-tenant billing, admin panel for plans

## ✅ WHAT HAS BEEN DONE

We have already extracted all valuable patterns from:
1. **Meta WhatsApp Cloud API** — Official Postman collection (14,946 lines parsed)
2. **WhatsApp Business Management API** — Official Postman collection (5,343 lines parsed)
3. **Embedded Signup API** — Official Postman collection (1,786 lines parsed)
4. **Whatomate project** — GitHub repo structure, API endpoints, architecture patterns, business logic

These are distilled into 3 focused reference documents in `docs/whatsapp-reference/`:

### Reference Documents:

| File | Lines | Contents |
|---|---|---|
| `meta-api-patterns.md` | ~600 | Complete API endpoint reference: all message types, template CRUD, media, QR codes, embedded signup, business profile, WABA management |
| `webhook-events.md` | ~350 | All webhook payload structures: every inbound message type, all status updates, business management events, signature verification, handler routing logic |
| `business-logic.md` | ~300 | Campaign execution flow, chat architecture, template variable resolution, automation matching, CSV import, embedded signup server flow, pricing calculation, whatomate-to-nyife service mapping |

**Total: ~1,250 lines of highly concentrated, production-ready reference material**

vs. Whatomate full codebase: 50,000+ lines of Go/Vue code that would destroy Claude Code's context window.

## HOW TO USE THESE REFERENCES

### During Phase 4 (WhatsApp Core — THE most critical phase):

Tell Claude Code:
```
Before implementing any WhatsApp-related code, read these reference docs:
- docs/whatsapp-reference/meta-api-patterns.md — for all API endpoints and payloads
- docs/whatsapp-reference/webhook-events.md — for webhook handler implementation
- docs/whatsapp-reference/business-logic.md — for campaign, chat, and automation logic
```

### What each service should reference:

| Service | Primary Reference | Key Sections |
|---|---|---|
| whatsapp-service | meta-api-patterns.md + webhook-events.md | Sections 1-4 (setup, messages), all webhook handling |
| template-service | meta-api-patterns.md | Section 6 (Template CRUD — all types: standard, auth, carousel, flow, catalog, MPM) |
| campaign-service | business-logic.md | Section 1 (Campaign execution), Section 3 (Variable resolution), Section 7 (Pricing) |
| chat-service | business-logic.md + webhook-events.md | Section 2 (Chat architecture), incoming message types |
| automation-service | business-logic.md | Section 4 (Automation matching) |
| contact-service | business-logic.md | Section 5 (CSV import) |
| media-service | meta-api-patterns.md | Section 7 (Media upload/download) |

## WHAT WHATOMATE TAUGHT US (Key Architectural Decisions)

From analyzing whatomate's architecture, we learned and adapted:

### 1. Multi-tenant Data Isolation
Whatomate uses organization-level isolation. Nyife goes further with user-level tenancy where `user_id` is on every table.

### 2. Campaign Processing via Job Queue
Whatomate uses Redis Streams. Nyife uses Kafka for better durability and multi-consumer support (campaign status → both campaign-service and analytics-service need it).

### 3. Template Types
Whatomate supports: standard, authentication, catalog, MPM, flow templates. Nyife supports all these plus carousel and list_menu templates. The reference docs contain exact JSON structures for creating ALL template types.

### 4. Chatbot Flow Engine
Whatomate has a sophisticated flow builder with skip conditions, branching, and AI integration. Nyife adapts this into the automation-service with a step-based flow engine stored as JSON.

### 5. RBAC Model
Whatomate has 3 roles: Admin, Manager, Agent. Nyife has granular resource-level permissions with a JSON permission object, supporting both user-level and admin-level RBAC.

### 6. Real-time Architecture
Whatomate uses WebSocket directly. Nyife uses Socket.IO with Redis adapter for multi-instance support, with namespaces for chat and notifications.

## WHAT NYIFE ADDS BEYOND WHATOMATE

Whatomate is a great open-source project but is NOT SaaS. Nyife adds:

| Feature | Whatomate | Nyife |
|---|---|---|
| Architecture | Monolithic Go | 17 Node.js microservices |
| Multi-tenancy | Organization-level | User-level SaaS |
| Subscriptions | None | Plans (monthly/yearly/lifetime) with limits |
| Payments | None | Razorpay (plans + wallet recharge) |
| Wallet | None | Prepaid balance, per-message debit |
| Invoices | None | Auto-generated with tax calculation |
| Admin Panel | Basic | Full admin dashboard, sub-admin RBAC |
| Support | None | Ticket system with assignment |
| Developer API | None | API tokens with multi-language docs |
| Notifications | None | In-app + email + push, admin broadcasts |
| Email Management | None | Transactional + marketing emails |
| Coupons | None | Discount codes for plans |
| Analytics | Basic dashboard | Aggregated service for user + admin |
| Frontend | Vue.js 3 | React + shadcn/ui |
| Database | PostgreSQL | MySQL 8.0 |
| Message Broker | Redis Streams | Apache Kafka |
| Deployment | Single binary | Docker microservices |
