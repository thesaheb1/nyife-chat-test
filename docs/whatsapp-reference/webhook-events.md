# WhatsApp Webhook Events — Complete Reference for Nyife

> All webhook payloads from Meta's WhatsApp Cloud API.
> Webhook endpoint: `POST /api/v1/whatsapp/webhook`
> Verification: `GET /api/v1/whatsapp/webhook` (challenge-response)

---

## WEBHOOK VERIFICATION (GET)

Meta sends a GET request to verify your webhook URL:
```
GET /webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```
**Response:** Return `hub.challenge` value as plain text with HTTP 200 if `hub.verify_token` matches.

---

## SIGNATURE VERIFICATION

Every POST webhook has `X-Hub-Signature-256` header.
```javascript
// Node.js verification
const crypto = require('crypto');
function verifyWebhookSignature(payload, signature, appSecret) {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return `sha256=${expectedSignature}` === signature;
}
```

---

## COMMON WEBHOOK ENVELOPE

All webhooks follow this structure:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "16505553333",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        // ONE OF: messages[], statuses[], errors[]
        "contacts": [{ "profile": { "name": "Contact Name" }, "wa_id": "SENDER_PHONE" }],
        "messages": [{ ... }],
        "statuses": [{ ... }]
      },
      "field": "messages"
    }]
  }]
}
```

**Parsing logic:**
1. Loop `entry[].changes[]`
2. Check `value.messages` → incoming messages
3. Check `value.statuses` → delivery status updates
4. `value.metadata.phone_number_id` → identifies which WA account received this

---

## INCOMING MESSAGE TYPES

### Text Message
```json
{
  "from": "16315551234",
  "id": "wamid.ABGGFlCGg0cvAgo-sJQh43L5Pe4W",
  "timestamp": "1603059201",
  "type": "text",
  "text": { "body": "Hello this is an answer" }
}
```

### Image Message
```json
{
  "from": "PHONE", "id": "wamid.id", "timestamp": "TS",
  "type": "image",
  "image": {
    "caption": "This is a caption",
    "mime_type": "image/jpeg",
    "sha256": "hash...",
    "id": "2754859441498128"
  }
}
```
**Note:** Use `GET /{image.id}` to get download URL, then download the file.

### Sticker Message
```json
{
  "type": "sticker",
  "sticker": { "id": "ID", "animated": false, "mime_type": "image/webp", "sha256": "HASH" }
}
```

### Audio/Video/Document (same pattern as image)
```json
{ "type": "audio", "audio": { "id": "ID", "mime_type": "audio/ogg", "sha256": "HASH" } }
{ "type": "video", "video": { "id": "ID", "mime_type": "video/mp4", "sha256": "HASH", "caption": "..." } }
{ "type": "document", "document": { "id": "ID", "mime_type": "application/pdf", "sha256": "HASH", "filename": "doc.pdf", "caption": "..." } }
```

### Location Message
```json
{
  "type": "location",
  "location": { "latitude": "LAT", "longitude": "LONG", "name": "Place Name", "address": "Full Address" }
}
```

### Contact Message
```json
{
  "type": "contacts",
  "contacts": [{
    "addresses": [{ "city": "NYC", "country": "US", "street": "123 St", "type": "HOME", "zip": "10001" }],
    "birthday": "1990-01-01",
    "emails": [{ "email": "john@example.com", "type": "WORK" }],
    "name": { "formatted_name": "John Doe", "first_name": "John", "last_name": "Doe" },
    "org": { "company": "Acme", "department": "Sales", "title": "Manager" },
    "phones": [{ "phone": "+1234567890", "wa_id": "1234567890", "type": "WORK" }],
    "urls": [{ "url": "https://example.com", "type": "WORK" }]
  }]
}
```

### Reaction Message
```json
{
  "type": "reaction",
  "reaction": { "emoji": "👍", "message_id": "wamid.ORIGINAL_MSG" }
}
```
**Note:** Empty emoji means reaction was removed.

### Button Reply (from Quick Reply buttons)
```json
{
  "type": "button",
  "button": { "text": "No", "payload": "No-Button-Payload" },
  "context": { "from": "16505553333", "id": "wamid.ORIGINAL_MSG" }
}
```

### List Reply (from List messages)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "list_reply",
    "list_reply": { "id": "row_1", "title": "Selected Option", "description": "..." }
  }
}
```

### Button Reply (from interactive buttons)
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": { "id": "btn_yes", "title": "Yes" }
  }
}
```

### Order Message (from catalog)
```json
{
  "type": "order",
  "order": {
    "catalog_id": "CAT_ID",
    "product_items": [
      { "product_retailer_id": "SKU", "quantity": "2", "item_price": "999", "currency": "INR" }
    ],
    "text": "Optional order note"
  }
}
```

### Product Enquiry
```json
{
  "type": "text",
  "text": { "body": "How much is this?" },
  "context": {
    "from": "PHONE", "id": "wamid.ID",
    "referred_product": { "catalog_id": "CAT_ID", "product_retailer_id": "PRODUCT_ID" }
  }
}
```

### Click-to-WhatsApp Ad Referral
```json
{
  "type": "text",
  "text": { "body": "Hi!" },
  "referral": {
    "source_url": "https://fb.com/ad/...",
    "source_id": "AD_ID",
    "source_type": "ad",
    "headline": "Ad Title",
    "body": "Ad Description",
    "media_type": "image",
    "image_url": "https://...",
    "thumbnail_url": "https://..."
  }
}
```

### Unknown/Unsupported Message
```json
{
  "type": "unknown",
  "errors": [{ "code": 130501, "details": "Message type is not currently supported", "title": "Unsupported message type" }]
}
```

### Message with Identity Change (Security Notification)
```json
{
  "type": "text",
  "text": { "body": "Hi" },
  "identity": { "acknowledged": true, "created_timestamp": 1602532300000, "hash": "Sjvjlx8G6Z0=" }
}
```

---

## STATUS UPDATES

### Message Sent
```json
{
  "statuses": [{
    "id": "wamid.ID",
    "status": "sent",
    "timestamp": "1603086313",
    "recipient_id": "PHONE",
    "conversation": {
      "id": "CONVERSATION_ID",
      "expiration_timestamp": 1603172713,
      "origin": { "type": "business_initiated" }
    },
    "pricing": {
      "pricing_model": "CBP",
      "billable": true,
      "category": "business_initiated"
    }
  }]
}
```

### Message Delivered
```json
{ "status": "delivered", ... same structure as sent }
```

### Message Read
```json
{ "status": "read", ... same structure (no pricing/conversation on read) }
```

### Message Failed
```json
{
  "statuses": [{
    "id": "wamid.ID",
    "status": "failed",
    "timestamp": "TS",
    "recipient_id": "PHONE",
    "errors": [{ "code": 131014, "title": "Request for url failed with 404" }]
  }]
}
```

### Message Deleted (by sender)
Appears as `type: "unsupported"` with error code 131051.

---

## STATUS FLOW
```
pending → sent → delivered → read
                                ↘ failed (can happen at any point)
```

### Origin Types (for pricing)
- `user_initiated` — User messaged first (24hr window)
- `business_initiated` — Business sends template outside window
- `referral_conversion` — From Click-to-WhatsApp ad (free tier)

### Pricing Categories
- `authentication` — OTP templates
- `marketing` — Promotional templates
- `utility` — Transactional templates
- `service` — Within 24hr user-initiated window
- `referral_conversion` — From ads

---

## BUSINESS MANAGEMENT WEBHOOKS (from Embedded Signup collection)

### Phone Number Name Update
```json
{
  "field": "phone_number_name",
  "value": { "display_phone_number": "PHONE", "decision": "APPROVED", "requested_verified_name": "New Name" }
}
```

### Phone Number Quality Update
```json
{
  "field": "phone_number_quality_update",
  "value": { "display_phone_number": "PHONE", "event": "FLAGGED", "current_limit": "TIER_1K" }
}
```

### Account Update (Ban/Restrict)
```json
{
  "field": "account_update",
  "value": { "phone_number": "PHONE", "event": "DISABLED" }
}
```

### Account Review Completed
```json
{
  "field": "account_review_update",
  "value": { "decision": "APPROVED" }
}
```

### Template Status Update
```json
{
  "field": "message_template_status_update",
  "value": { "event": "APPROVED", "message_template_id": "ID", "message_template_name": "name", "message_template_language": "en_US" }
}
```
**Events:** `APPROVED`, `REJECTED`, `PENDING_DELETION`, `DISABLED`, `PAUSED`, `IN_APPEAL`

### Payment Status (India/SG Payments)
```json
{
  "statuses": [{
    "id": "wamid.ID", "type": "payment", "status": "captured|failed|pending",
    "payment": { "reference_id": "order-ref-id" }
  }]
}
```

---

## NYIFE WEBHOOK HANDLER LOGIC

```
1. Verify X-Hub-Signature-256
2. Respond 200 immediately (process async)
3. Parse entry[].changes[].value:
   a. If value.messages exists → INCOMING MESSAGE
      - Extract: from, id, timestamp, type, content
      - Identify which WA account: metadata.phone_number_id
      - Identify sender: contacts[0].wa_id, contacts[0].profile.name
      - Publish to Kafka: webhook.inbound
      - Consumers: chat-service (conversation), automation-service (triggers)
   
   b. If value.statuses exists → STATUS UPDATE
      - Extract: id (wamid), status, recipient_id, errors[], pricing
      - Update wa_messages table status
      - If campaign_id linked → publish to Kafka: campaign.status
      - If payment status → handle payment flow
   
   c. If field == "message_template_status_update" → TEMPLATE STATUS
      - Update template status in template-service
      - Notify user via notification-service
   
   d. If field == "phone_number_quality_update" → QUALITY ALERT
      - Update wa_accounts quality_rating
      - Notify user if degraded
   
   e. If field == "account_update" → ACCOUNT STATUS
      - Update wa_accounts status
      - Notify user if restricted/disabled
```
