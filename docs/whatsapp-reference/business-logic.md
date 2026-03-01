# Business Logic Patterns — Extracted from Whatomate, Adapted for Nyife

> These are architecture and business logic patterns observed in whatomate.
> They are adapted for Nyife's Node.js microservice architecture.
> DO NOT copy Go code — use these as conceptual reference only.

---

## 1. CAMPAIGN EXECUTION FLOW

### Whatomate Pattern:
- Uses Redis Streams with consumer groups for reliable job processing
- Campaign start enqueues all recipients as individual jobs
- Workers pick up jobs, send messages via Meta API, report status
- Failed messages can be retried with exponential backoff
- Campaign stats updated in real-time

### Nyife Adaptation (Kafka):
```
1. User clicks "Start Campaign"
2. campaign-service validates:
   - Template is APPROVED
   - Subscription message limit not exceeded
   - Wallet balance >= estimated_cost
3. Resolve target contacts from groups/tags/contact_ids
4. Create campaign_messages records (status: pending)
5. Batch contacts into groups of 50
6. Publish each batch to Kafka topic: campaign.execute
7. Update campaign status → running

CONSUMER (whatsapp-service):
8. Receive batch from Kafka
9. For each message in batch:
   a. Resolve template variables from contact fields
   b. Call Meta API POST /{phone_number_id}/messages
   c. On success: publish status update (sent) to campaign.status
   d. On failure: publish failure to campaign.status
   e. Rate limit: max 80 messages/second (Meta limit)
   f. Debit wallet per message

CONSUMER (campaign-service):
10. Receive status from campaign.status Kafka topic
11. Update campaign_messages record
12. Increment campaign aggregate counters
13. Emit Socket.IO event for real-time dashboard
14. When all messages processed: mark campaign completed
```

### Rate Limiting Strategy:
- Meta allows ~80 msgs/sec for standard tier, 1000/sec for higher tiers
- Implement sliding window in Redis: `INCR campaign:{id}:rate` with TTL 1s
- If exceeded, delay batch processing with setTimeout or Kafka retry
- Respect `Retry-After` headers from Meta API 429 responses

### Retry Logic:
```
- Max 3 retries per message
- Exponential backoff: 30s, 120s, 300s
- Retryable errors: rate_limit, temporary_server_error, timeout
- Non-retryable: invalid_number, template_not_found, blocked
- On retry: increment retry_count, re-enqueue to Kafka
```

---

## 2. REAL-TIME CHAT ARCHITECTURE

### Whatomate Pattern:
- WebSocket connections for live chat
- Messages stored in PostgreSQL
- Contact assignment to agents (team members)
- Unread count tracking per conversation

### Nyife Adaptation:
```
INBOUND MESSAGE FLOW:
1. Meta webhook → whatsapp-service
2. whatsapp-service logs to wa_messages, publishes to Kafka: webhook.inbound
3. chat-service consumes webhook.inbound:
   a. Find or create conversation (by user_id + wa_account_id + contact_phone)
   b. Insert chat_message record
   c. Update conversation: last_message_at, last_message_preview, unread_count++
   d. Emit Socket.IO: 'new:message' to user's room
   e. Emit Socket.IO: 'conversation:updated' for sidebar refresh
   f. Check if automation should trigger → forward to automation-service

OUTBOUND MESSAGE FLOW (user sending from chat):
1. Frontend sends via API: POST /chat/conversations/{id}/send
2. chat-service receives, inserts chat_message (outbound, status: pending)
3. chat-service calls whatsapp-service API to send via Meta
4. whatsapp-service sends, returns wamid
5. chat-service updates message with meta_message_id
6. Status updates come back via webhook → update message status
7. Emit Socket.IO: 'message:status' for ✓✓ indicators
```

### Socket.IO Rooms:
```
- user:{userId} → all conversations for this user
- conversation:{conversationId} → specific chat view
- On connect: join user room
- On open conversation: join conversation room
- On close conversation: leave conversation room
```

---

## 3. TEMPLATE VARIABLE RESOLUTION

### Pattern:
Templates have placeholders like `{{1}}`, `{{2}}` that must be replaced with actual values when sending.

### Variable Mapping:
Campaign stores a `variables_mapping` JSON:
```json
{
  "1": "name",           // maps {{1}} → contact.name
  "2": "phone",          // maps {{2}} → contact.phone  
  "3": "email",          // maps {{3}} → contact.email
  "4": "custom_fields.order_id"  // maps {{4}} → contact.custom_fields.order_id
}
```

### Resolution Logic:
```javascript
function resolveVariables(template, contact, variablesMapping) {
  const parameters = [];
  for (const [index, fieldPath] of Object.entries(variablesMapping)) {
    const value = getNestedValue(contact, fieldPath) || '';
    parameters.push({ type: 'text', text: value });
  }
  return parameters;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
```

---

## 4. CHATBOT / AUTOMATION MATCHING

### Whatomate Pattern:
- Keyword-based: exact match, contains, regex
- Flow-based: multi-step conversations with state tracking
- AI-powered: OpenAI/Anthropic/Google for intelligent responses
- Priority-based: first matching rule wins

### Nyife Adaptation:
```
MATCHING ORDER (highest to lowest priority):
1. Check if contact is in an active flow → continue flow
2. Check keyword automations (sorted by priority):
   a. exact: message.text === trigger_value
   b. contains: message.text.includes(trigger_value)
   c. regex: new RegExp(trigger_value).test(message.text)
   d. message_type: message.type === trigger_value (e.g., "image", "location")
3. If no match → check default/fallback automation
4. If nothing → no automation (message just appears in chat)

STATE TRACKING FOR FLOWS:
- Store in Redis: `automation:flow:{userId}:{contactPhone}` with TTL (e.g., 30 min)
- Value: { automationId, currentStepId, collectedData: {}, startedAt }
- On each message: check if active flow exists → execute next step
- On timeout: clean up, optionally send timeout message
```

---

## 5. CONTACT CSV IMPORT

### Whatomate Pattern:
- CSV upload with column mapping
- Validation: phone numbers in E.164 format
- Deduplication: skip if phone already exists for this user
- Bulk insert for performance

### Nyife Adaptation:
```
1. User uploads CSV via media-service
2. contact-service parses CSV (use csv-parser npm)
3. Validate:
   - Required: phone column
   - Phone format: strip spaces, ensure + prefix, validate E.164
   - Email format: if provided, validate
   - Max rows: check against subscription contact limit
4. For each row:
   a. Check if contact exists (user_id + phone unique)
   b. If exists: update if fields are empty
   c. If new: create
5. Return summary: { total, created, updated, skipped, errors: [{ row, reason }] }

For large files (>500 rows):
- Save file reference
- Enqueue processing job to Kafka
- Return immediately with "processing" status
- Notify user when complete via Socket.IO / notification
```

---

## 6. WHATSAPP EMBEDDED SIGNUP FLOW

### Whatomate Pattern:
- Facebook JS SDK on frontend
- User completes onboarding in Facebook popup
- SDK returns code/token
- Server exchanges for access token
- Server finds WABA ID, phone number ID, subscribes to webhooks

### Nyife Frontend Flow:
```javascript
// 1. Load Facebook SDK
window.fbAsyncInit = function() {
  FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v20.0' });
};

// 2. Launch Embedded Signup
FB.login(function(response) {
  if (response.authResponse) {
    const code = response.authResponse.code;
    // Send code to backend
    axios.post('/api/v1/whatsapp/accounts/embedded-signup', { code });
  }
}, {
  config_id: 'YOUR_CONFIG_ID', // From Meta dashboard
  response_type: 'code',
  override_default_response_type: true,
  extras: {
    setup: { /* optional pre-fill */ },
    featureType: '',
    sessionInfoVersion: '3'
  }
});
```

### Nyife Backend Flow:
```
1. Receive code from frontend
2. Exchange code for token: GET /oauth/access_token?client_id=APP_ID&client_secret=APP_SECRET&code=CODE
3. Debug token to get WABA ID: GET /debug_token?input_token=TOKEN
4. Get shared WABAs: GET /{BUSINESS_ID}/client_whatsapp_business_accounts
5. Get phone numbers: GET /{WABA_ID}/phone_numbers
6. Subscribe app: POST /{WABA_ID}/subscribed_apps
7. Store in wa_accounts: waba_id, phone_number_id, access_token (encrypted), verified_name
8. Increment subscription usage: whatsapp_numbers_used++
9. Return success to frontend
```

---

## 7. MESSAGE PRICING CALCULATION

### Pattern:
Each message type has a different cost. The cost is defined per subscription plan.

### Logic:
```javascript
function calculateMessageCost(plan, template) {
  switch (template.category) {
    case 'MARKETING': return plan.marketing_message_price;  // in paise
    case 'UTILITY': return plan.utility_message_price;
    case 'AUTHENTICATION': return plan.auth_message_price;
    default: return plan.marketing_message_price;  // fallback
  }
}

// For campaigns:
function calculateCampaignCost(plan, template, recipientCount) {
  const perMessage = calculateMessageCost(plan, template);
  return perMessage * recipientCount;
}
```

---

## 8. WHATOMATE API ROUTES → NYIFE SERVICE MAPPING

| Whatomate Route | Nyife Service | Nyife Route |
|---|---|---|
| POST /api/auth/* | auth-service | /api/v1/auth/* |
| GET/POST /api/users/* | user-service + organization-service | /api/v1/users/*, /api/v1/organizations/* |
| GET/POST /api/accounts/* | whatsapp-service | /api/v1/whatsapp/accounts/* |
| GET/POST /api/contacts/* | contact-service | /api/v1/contacts/* |
| GET/POST /api/templates/* | template-service | /api/v1/templates/* |
| GET/POST /api/campaigns/* | campaign-service | /api/v1/campaigns/* |
| GET/POST /api/flows/* | template-service (flow type) | /api/v1/templates/* (type=flow) |
| GET/POST /api/chatbot/* | automation-service | /api/v1/automations/* |
| GET/POST /api/webhook | whatsapp-service | /api/v1/whatsapp/webhook |
| WebSocket /ws | chat-service | Socket.IO /chat |

---

## 9. WHATOMATE FEATURES NOT IN MONOLITH (Nyife SaaS Additions)

These are features Nyife adds that whatomate doesn't have:

1. **Multi-tenant SaaS** — subscription plans, limits, per-user isolation
2. **Wallet system** — prepaid balance, per-message debit, invoices
3. **Payment gateway** — Razorpay integration for plans + recharge
4. **Super admin panel** — user management, plan management, sub-admins
5. **Admin RBAC** — sub-admin roles with resource-level permissions
6. **Support ticket system** — user queries, admin responses, assignment
7. **Notification system** — in-app + email + push, admin broadcasts
8. **Email management** — transactional templates, bulk sending
9. **Developer API tokens** — user-generated API tokens with docs
10. **Coupon/discount system** — plan discounts, promotional codes
11. **Analytics service** — aggregated metrics, admin + user dashboards
12. **Tax calculation** — GST inclusive/exclusive on plans and recharge
