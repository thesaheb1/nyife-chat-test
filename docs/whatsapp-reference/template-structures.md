# WhatsApp Template Structures — Complete Component Reference for Nyife

> Every template type's create & send JSON structure.
> Used by: template-service (CRUD), campaign-service (sending), whatsapp-service (Meta API calls)
> API: `POST /{WABA_ID}/message_templates` (create) | `POST /{PHONE_NUMBER_ID}/messages` (send)

---

## TEMPLATE CATEGORIES

| Category | Use Case | Requires Approval | Can Initiate Conversation |
|---|---|---|---|
| `MARKETING` | Promotions, offers, newsletters | Yes | Yes |
| `UTILITY` | Order updates, receipts, alerts | Yes | Yes |
| `AUTHENTICATION` | OTP codes, login verification | Yes | Yes |

---

## COMPONENT TYPES

Every template is built from these components:

| Component | Required | Max Count | Notes |
|---|---|---|---|
| `HEADER` | No | 1 | TEXT, IMAGE, VIDEO, DOCUMENT, or LOCATION format |
| `BODY` | Yes | 1 | Main message text. Supports `{{1}}`, `{{2}}` variables |
| `FOOTER` | No | 1 | Small text below body |
| `BUTTONS` | No | 1 (array) | Max 10 buttons total. Types: QUICK_REPLY, URL, PHONE_NUMBER, OTP, FLOW, CATALOG, MPM |

### Variable Syntax:
- In create: `{{1}}`, `{{2}}` etc. with `example` object showing sample values
- In send: `parameters` array in order matching `{{1}}`, `{{2}}`
- Header variables: `{{1}}` only (max 1 variable)
- Body variables: `{{1}}` through `{{n}}` (unlimited)

---

## 1. STANDARD MARKETING — Text Header + Quick Reply Buttons

### Create:
```json
{
  "name": "seasonal_promotion",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Our {{1}} is on!",
      "example": { "header_text": ["Summer Sale"] }
    },
    {
      "type": "BODY",
      "text": "Shop now through {{1}} and use code {{2}} to get {{3}} off of all merchandise.",
      "example": { "body_text": [["the end of August", "25OFF", "25%"]] }
    },
    {
      "type": "FOOTER",
      "text": "Use the buttons below to manage your marketing subscriptions"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Unsubscribe from Promos" },
        { "type": "QUICK_REPLY", "text": "Unsubscribe from All" }
      ]
    }
  ]
}
```

### Send:
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "type": "template",
  "template": {
    "name": "seasonal_promotion",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "header",
        "parameters": [{ "type": "text", "text": "Summer Sale" }]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "the end of August" },
          { "type": "text", "text": "25OFF" },
          { "type": "text", "text": "25%" }
        ]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": 0,
        "parameters": [{ "type": "payload", "payload": "unsubscribe_promos" }]
      },
      {
        "type": "button",
        "sub_type": "quick_reply",
        "index": 1,
        "parameters": [{ "type": "payload", "payload": "unsubscribe_all" }]
      }
    ]
  }
}
```

---

## 2. IMAGE HEADER — With CTA Buttons (Phone + URL)

### Create:
```json
{
  "name": "limited_time_offer",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "IMAGE",
      "example": { "header_handle": ["4::aW1hZ2UvaGFuZGxl..."] }
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}! Get our {{2}} for as low as {{3}}. Tap Offer Details for more.",
      "example": { "body_text": [["Mark", "Tuscan Getaway package", "800"]] }
    },
    {
      "type": "FOOTER",
      "text": "Offer valid until May 31, 2026"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "PHONE_NUMBER", "text": "Call", "phone_number": "15550051310" },
        {
          "type": "URL",
          "text": "Shop Now",
          "url": "https://www.example.com/shop?promo={{1}}",
          "example": ["summer2026"]
        }
      ]
    }
  ]
}
```

**Note on `header_handle`:** Upload image first via `POST /{APP_ID}/uploads` to get a handle. Format: `"4::base64data..."`.

### Send:
```json
{
  "template": {
    "name": "limited_time_offer",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "header",
        "parameters": [
          { "type": "image", "image": { "link": "https://example.com/promo.jpg" } }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Mark" },
          { "type": "text", "text": "Tuscan Getaway package" },
          { "type": "text", "text": "800" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": 1,
        "parameters": [{ "type": "text", "text": "summer2026" }]
      }
    ]
  }
}
```

---

## 3. VIDEO HEADER

### Create:
```json
{
  "type": "HEADER",
  "format": "VIDEO",
  "example": { "header_handle": ["4::video_handle..."] }
}
```

### Send:
```json
{
  "type": "header",
  "parameters": [
    { "type": "video", "video": { "link": "https://example.com/video.mp4" } }
  ]
}
```

---

## 4. DOCUMENT HEADER — With Phone + URL Buttons

### Create:
```json
{
  "name": "order_confirmation",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "DOCUMENT",
      "example": { "header_handle": ["4::ZG9jdW1lbnQ..."] }
    },
    {
      "type": "BODY",
      "text": "Thank you {{1}}! Order #{{2}}. Tap the PDF above for your receipt.",
      "example": { "body_text": [["Mark", "860198-230332"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "PHONE_NUMBER", "text": "Call", "phone_number": "16467043595" },
        { "type": "URL", "text": "Contact Support", "url": "https://example.com/support" }
      ]
    }
  ]
}
```

### Send:
```json
{
  "type": "header",
  "parameters": [
    { "type": "document", "document": { "link": "https://example.com/receipt.pdf", "filename": "receipt.pdf" } }
  ]
}
```

---

## 5. LOCATION HEADER

### Create:
```json
{
  "name": "delivery_update",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    { "type": "HEADER", "format": "LOCATION" },
    {
      "type": "BODY",
      "text": "Good news {{1}}! Your order #{{2}} is on its way to the location above.",
      "example": { "body_text": [["Mark", "566701"]] }
    },
    { "type": "FOOTER", "text": "Tap below to stop delivery updates." },
    {
      "type": "BUTTONS",
      "buttons": [{ "type": "QUICK_REPLY", "text": "Stop Delivery Updates" }]
    }
  ]
}
```

### Send:
```json
{
  "type": "header",
  "parameters": [{
    "type": "location",
    "location": {
      "latitude": "37.483307",
      "longitude": "122.148981",
      "name": "Delivery Point",
      "address": "1 Hacker Way, Menlo Park"
    }
  }]
}
```

---

## 6. AUTHENTICATION — OTP Copy Code

### Create:
```json
{
  "name": "auth_otp_copy_code",
  "language": "en_US",
  "category": "AUTHENTICATION",
  "components": [
    {
      "type": "BODY",
      "add_security_recommendation": true
    },
    {
      "type": "FOOTER",
      "code_expiration_minutes": 10
    },
    {
      "type": "BUTTONS",
      "buttons": [{
        "type": "OTP",
        "otp_type": "COPY_CODE",
        "text": "Copy Code"
      }]
    }
  ]
}
```

**Notes:**
- Body text is auto-generated by Meta: `"{{1}} is your verification code."` (you cannot customize it)
- `add_security_recommendation: true` appends "For your security, do not share this code."
- `code_expiration_minutes` adds "This code expires in X minutes."

### Send:
```json
{
  "template": {
    "name": "auth_otp_copy_code",
    "language": { "code": "en_US" },
    "components": [{
      "type": "body",
      "parameters": [{ "type": "text", "text": "784293" }]
    }]
  }
}
```

---

## 7. AUTHENTICATION — One-Tap Autofill (Android only)

### Create:
```json
{
  "name": "auth_otp_autofill",
  "language": "en_US",
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 10 },
    {
      "type": "BUTTONS",
      "buttons": [{
        "type": "OTP",
        "otp_type": "ONE_TAP",
        "text": "Copy Code",
        "autofill_text": "Autofill",
        "package_name": "com.example.myapp",
        "signature_hash": "K8a%2FAINcGX7"
      }]
    }
  ]
}
```

**Notes:**
- `package_name`: Android app package name
- `signature_hash`: From Android SMS Retriever API
- Falls back to Copy Code on iOS and if autofill fails

### Send: Same as OTP Copy Code above.

---

## 8. CATALOG TEMPLATE

### Create:
```json
{
  "name": "catalog_offer",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "BODY",
      "text": "Shop on WhatsApp! Get Rs {{1}} off on orders above {{2}}Rs! Valid for first {{3}} orders.",
      "example": { "body_text": [["100", "400", "3"]] }
    },
    { "type": "FOOTER", "text": "Best grocery deals on WhatsApp!" },
    {
      "type": "BUTTONS",
      "buttons": [{ "type": "CATALOG", "text": "View catalog" }]
    }
  ]
}
```

### Send:
```json
{
  "template": {
    "name": "catalog_offer",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "100" },
          { "type": "text", "text": "400" },
          { "type": "text", "text": "3" }
        ]
      },
      {
        "type": "button",
        "sub_type": "CATALOG",
        "index": 0,
        "parameters": [{
          "type": "action",
          "action": { "thumbnail_product_retailer_id": "SKU_ID" }
        }]
      }
    ]
  }
}
```

---

## 9. MULTI-PRODUCT MESSAGE (MPM) TEMPLATE

### Create:
```json
{
  "name": "abandoned_cart",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Forget something {{1}}?",
      "example": { "header_text": ["Pablo"] }
    },
    {
      "type": "BODY",
      "text": "Looks like you left items in your cart! Use code {{1}} for 10% off!",
      "example": { "body_text": [["10OFF"]] }
    },
    {
      "type": "BUTTONS",
      "buttons": [{ "type": "MPM", "text": "View items" }]
    }
  ]
}
```

### Send:
```json
{
  "template": {
    "name": "abandoned_cart",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "header",
        "parameters": [{ "type": "text", "text": "Pablo" }]
      },
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "10OFF" }]
      },
      {
        "type": "button",
        "sub_type": "mpm",
        "index": 0,
        "parameters": [{
          "type": "action",
          "action": {
            "thumbnail_product_retailer_id": "SKU_1",
            "sections": [
              {
                "title": "Your Cart",
                "product_items": [
                  { "product_retailer_id": "SKU_1" },
                  { "product_retailer_id": "SKU_2" }
                ]
              }
            ]
          }
        }]
      }
    ]
  }
}
```

---

## 10. FLOW TEMPLATE — By Flow Name

### Create:
```json
{
  "name": "feedback_survey",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "body", "text": "We'd love your feedback! Complete our quick survey." },
    {
      "type": "BUTTONS",
      "buttons": [{
        "type": "FLOW",
        "text": "Start Survey",
        "flow_name": "customer_feedback_v1",
        "navigate_screen": "WELCOME_SCREEN",
        "flow_action": "navigate"
      }]
    }
  ]
}
```

### Create — By Flow ID:
```json
{
  "type": "FLOW",
  "text": "Start Survey",
  "flow_id": "1234567890",
  "navigate_screen": "WELCOME_SCREEN",
  "flow_action": "navigate"
}
```

### Create — With Inline Flow JSON:
```json
{
  "type": "FLOW",
  "text": "Open Form",
  "flow_json": "{\"version\":\"5.0\",\"screens\":[{\"id\":\"WELCOME_SCREEN\",\"layout\":{\"type\":\"SingleColumnLayout\",\"children\":[{\"type\":\"TextHeading\",\"text\":\"Hello World\"},{\"type\":\"Footer\",\"label\":\"Complete\",\"on-click-action\":{\"name\":\"complete\",\"payload\":{}}}]},\"title\":\"Welcome\",\"terminal\":true,\"success\":true,\"data\":{}}]}",
  "navigate_screen": "WELCOME_SCREEN",
  "flow_action": "navigate"
}
```

### Send:
```json
{
  "template": {
    "name": "feedback_survey",
    "language": { "code": "en_US" },
    "components": [{
      "type": "button",
      "sub_type": "flow",
      "index": "0",
      "parameters": [{
        "type": "action",
        "action": {
          "flow_token": "user_123_session_abc",
          "flow_action_data": { "user_name": "John", "order_id": "ORD-456" }
        }
      }]
    }]
  }
}
```

---

## 11. BODY PARAMETER TYPES

Beyond simple text, body parameters support these types:

### Currency
```json
{
  "type": "currency",
  "currency": {
    "fallback_value": "₹999.00",
    "code": "INR",
    "amount_1000": 999000
  }
}
```
**Note:** `amount_1000` = amount × 1000. So ₹999.00 = 999000.

### Date/Time
```json
{
  "type": "date_time",
  "date_time": {
    "fallback_value": "March 1, 2026",
    "day_of_week": 7,
    "year": 2026,
    "month": 3,
    "day_of_month": 1,
    "hour": 10,
    "minute": 30,
    "calendar": "GREGORIAN"
  }
}
```

---

## 12. BUTTON TYPE SUMMARY

| Button Type | Used In | Max Per Template | Notes |
|---|---|---|---|
| `QUICK_REPLY` | Marketing, Utility | 10 | Returns payload via webhook |
| `URL` | Marketing, Utility | 2 | Can have 1 dynamic variable `{{1}}` |
| `PHONE_NUMBER` | Marketing, Utility | 1 | Static phone number |
| `OTP` | Authentication only | 1 | COPY_CODE or ONE_TAP |
| `CATALOG` | Marketing | 1 | Opens product catalog |
| `MPM` | Marketing | 1 | Opens multi-product selector |
| `FLOW` | Marketing, Utility | 1 | Opens WhatsApp Flow |

### Button Limits:
- Max 10 buttons total per template
- Max 3 QUICK_REPLY buttons
- Max 2 URL buttons
- Only 1 each of: PHONE_NUMBER, CATALOG, MPM, FLOW, OTP

---

## 13. TEMPLATE STATUS LIFECYCLE

```
PENDING → APPROVED → (active use)
    ↓         ↓
 REJECTED   PAUSED → IN_APPEAL → APPROVED
              ↓
           DISABLED
              ↓
        PENDING_DELETION → (deleted after 30 days)
```

### Status Webhook:
```json
{
  "field": "message_template_status_update",
  "value": {
    "event": "APPROVED",
    "message_template_id": "123456",
    "message_template_name": "seasonal_promotion",
    "message_template_language": "en_US"
  }
}
```
**Events:** `APPROVED`, `REJECTED`, `PENDING_DELETION`, `DISABLED`, `PAUSED`, `IN_APPEAL`

---

## 14. NYIFE TEMPLATE DATABASE SCHEMA REFERENCE

The template-service should store templates with these fields:
```
wa_templates:
  id (UUID PK)
  user_id (FK → users)
  wa_account_id (FK → wa_accounts)
  meta_template_id (string, from Meta)
  name (string, unique per WABA)
  language (string, e.g. "en_US")
  category (enum: MARKETING, UTILITY, AUTHENTICATION)
  status (enum: PENDING, APPROVED, REJECTED, PAUSED, DISABLED, IN_APPEAL, PENDING_DELETION)
  components (JSON — full component array as sent to Meta)
  header_type (enum: NONE, TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION)
  button_type (enum: NONE, QUICK_REPLY, CTA, OTP, CATALOG, MPM, FLOW)
  variables_count (int — total {{n}} variables)
  example_values (JSON — sample values for variables)
  rejection_reason (text, null)
  quality_score (string, null)
  created_at
  updated_at
  deleted_at (soft delete)
```
