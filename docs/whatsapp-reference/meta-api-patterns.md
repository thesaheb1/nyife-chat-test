# Meta WhatsApp Cloud API — Complete Endpoint Reference for Nyife

> Extracted from official Meta Postman collections (Cloud API, Business Management API, Embedded Signup).
> API Version: v20.0+  
> Base URL: `https://graph.facebook.com/v20.0`  
> Auth: `Authorization: Bearer {access_token}`

---

## 1. ACCOUNT SETUP & REGISTRATION

### Subscribe App to WABA (required for webhooks)
```
POST /{WABA_ID}/subscribed_apps
→ { "success": "true" }
```

### Get Phone Numbers for WABA
```
GET /{WABA_ID}/phone_numbers
→ { "data": [{ "verified_name": "...", "display_phone_number": "+1...", "id": "PHONE_NUMBER_ID", "quality_rating": "GREEN" }] }
```

### Get Single Phone Number Details
```
GET /{PHONE_NUMBER_ID}
→ { "verified_name": "...", "display_phone_number": "...", "id": "...", "quality_rating": "GREEN" }
```

### Get Display Name Status
```
GET /{PHONE_NUMBER_ID}?fields=name_status
```

### Register Phone Number
```
POST /{PHONE_NUMBER_ID}/register
Body: { "messaging_product": "whatsapp", "pin": "6-digit-pin" }
```

### Deregister Phone Number
```
POST /{PHONE_NUMBER_ID}/deregister
```

### Request Verification Code
```
POST /{PHONE_NUMBER_ID}/request_code
Body: { "code_method": "SMS", "locale": "en_US" }
```

### Verify Code
```
POST /{PHONE_NUMBER_ID}/verify_code
Body: { "code": "123456" }
```

### Set Two-Step Verification PIN
```
POST /{PHONE_NUMBER_ID}
Body: { "pin": "123456" }
```

### Debug Access Token
```
GET /debug_token?input_token={TOKEN}
```

---

## 2. WABA MANAGEMENT

### Get WABA Details
```
GET /{WABA_ID}
```

### Get Owned WABAs (for a Business)
```
GET /{BUSINESS_ID}/owned_whatsapp_business_accounts
```

### Get Shared/Client WABAs
```
GET /{BUSINESS_ID}/client_whatsapp_business_accounts
```

### Get Template Namespace
```
GET /{WABA_ID}?fields=message_template_namespace
```

---

## 3. EMBEDDED SIGNUP (Solution Partner Flow)

### Step 1: After JS SDK callback → Exchange token
The frontend Embedded Signup SDK returns a code. Exchange it server-side:
```
GET /oauth/access_token?client_id={APP_ID}&client_secret={APP_SECRET}&code={CODE_FROM_SDK}
→ { "access_token": "...", "token_type": "bearer" }
```

### Step 2: Get System Users for Business
```
GET /{BUSINESS_ID}/system_users
```

### Step 3: Assign System User to WABA
```
POST /{WABA_ID}/assigned_users?user={SYSTEM_USER_ID}&tasks=['MANAGE']
```

### Step 4: Fetch Assigned Users
```
GET /{WABA_ID}/assigned_users?business={BUSINESS_ID}
```

### Step 5: Subscribe App to WABA
```
POST /{WABA_ID}/subscribed_apps
```

### Step 6 (Optional): Share Credit Line
```
GET /{BUSINESS_ID}/extendedcredits?fields=id,legal_entity_name
POST /{CREDIT_LINE_ID}/whatsapp_credit_sharing_and_attach?waba_id={WABA_ID}&waba_currency=INR
```

### Get Phone Numbers for Assigned WABA
```
GET /{WABA_ID}/phone_numbers
```

---

## 4. SENDING MESSAGES

**Endpoint:** `POST /{PHONE_NUMBER_ID}/messages`  
**Common response:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "PHONE", "wa_id": "PHONE" }],
  "messages": [{ "id": "wamid.XXX" }]
}
```

### 4.1 Text Message
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "text",
  "text": { "preview_url": false, "body": "Hello World" }
}
```

### 4.2 Text with URL Preview
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "text": { "preview_url": true, "body": "Visit https://example.com" }
}
```

### 4.3 Reply to a Message (context)
Add `"context": { "message_id": "wamid.ORIGINAL_MSG_ID" }` to any message to make it a reply.

### 4.4 Reaction
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "reaction",
  "reaction": { "message_id": "wamid.MSG_TO_REACT_TO", "emoji": "👍" }
}
```

### 4.5 Image — by Media ID
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "image",
  "image": { "id": "MEDIA_OBJECT_ID" }
}
```

### 4.6 Image — by URL
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "image",
  "image": { "link": "https://example.com/image.jpg" }
}
```

### 4.7 Audio — by ID / URL
```json
{ "type": "audio", "audio": { "id": "AUDIO_OBJECT_ID" } }
{ "type": "audio", "audio": { "link": "https://example.com/audio.ogg" } }
```

### 4.8 Video — by ID / URL
```json
{ "type": "video", "video": { "caption": "My video", "id": "VIDEO_OBJECT_ID" } }
{ "type": "video", "video": { "link": "https://example.com/video.mp4", "caption": "My video" } }
```

### 4.9 Document — by ID / URL
```json
{ "type": "document", "document": { "id": "DOC_ID", "caption": "Invoice", "filename": "invoice.pdf" } }
{ "type": "document", "document": { "link": "https://example.com/file.pdf", "caption": "Invoice" } }
```

### 4.10 Sticker — by ID / URL
```json
{ "type": "sticker", "sticker": { "id": "STICKER_ID" } }
{ "type": "sticker", "sticker": { "link": "https://example.com/sticker.webp" } }
```

### 4.11 Location
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "location",
  "location": {
    "latitude": "37.4847",
    "longitude": "-122.1477",
    "name": "Meta HQ",
    "address": "1 Hacker Way, Menlo Park"
  }
}
```

### 4.12 Contact Card
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "type": "contacts",
  "contacts": [{
    "addresses": [{ "street": "123 St", "city": "NYC", "state": "NY", "zip": "10001", "country": "US", "country_code": "US", "type": "WORK" }],
    "birthday": "1990-01-01",
    "emails": [{ "email": "john@example.com", "type": "WORK" }],
    "name": { "formatted_name": "John Doe", "first_name": "John", "last_name": "Doe" },
    "org": { "company": "Acme Inc", "department": "Sales", "title": "Manager" },
    "phones": [{ "phone": "+1234567890", "wa_id": "1234567890", "type": "WORK" }],
    "urls": [{ "url": "https://example.com", "type": "WORK" }]
  }]
}
```

### 4.13 Interactive — Reply Buttons (max 3)
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Choose an option:" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_yes", "title": "Yes" } },
        { "type": "reply", "reply": { "id": "btn_no", "title": "No" } },
        { "type": "reply", "reply": { "id": "btn_maybe", "title": "Maybe" } }
      ]
    }
  }
}
```

### 4.14 Interactive — List Message
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "PHONE",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": { "type": "text", "text": "Our Services" },
    "body": { "text": "Choose a service:" },
    "footer": { "text": "Powered by Nyife" },
    "action": {
      "button": "View Options",
      "sections": [
        {
          "title": "Support",
          "rows": [
            { "id": "row_1", "title": "Technical Help", "description": "Get tech support" },
            { "id": "row_2", "title": "Billing", "description": "Billing inquiries" }
          ]
        },
        {
          "title": "Sales",
          "rows": [
            { "id": "row_3", "title": "New Plan", "description": "Upgrade your plan" }
          ]
        }
      ]
    }
  }
}
```

### 4.15 Interactive — Single Product
```json
{
  "type": "interactive",
  "interactive": {
    "type": "product",
    "body": { "text": "Check this out!" },
    "action": { "catalog_id": "CATALOG_ID", "product_retailer_id": "SKU_ID" }
  }
}
```

### 4.16 Interactive — Multi-Product
```json
{
  "type": "interactive",
  "interactive": {
    "type": "product_list",
    "header": { "type": "text", "text": "Our Products" },
    "body": { "text": "Browse our catalog" },
    "action": {
      "catalog_id": "CATALOG_ID",
      "sections": [
        { "title": "Section 1", "product_items": [{ "product_retailer_id": "SKU1" }, { "product_retailer_id": "SKU2" }] }
      ]
    }
  }
}
```

### 4.17 Interactive — WhatsApp Flow (Published)
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "type": "interactive",
  "interactive": {
    "type": "flow",
    "header": { "type": "text", "text": "Survey" },
    "body": { "text": "Please complete this form" },
    "footer": { "text": "Takes 2 minutes" },
    "action": {
      "name": "flow",
      "parameters": {
        "flow_message_version": "3",
        "flow_action": "navigate",
        "flow_token": "FLOW_TOKEN",
        "flow_id": "FLOW_ID",
        "flow_cta": "Open Form",
        "flow_action_payload": {
          "screen": "SCREEN_ID",
          "data": { "custom_key": "custom_value" }
        }
      }
    }
  }
}
```

### 4.18 Mark Message As Read
```
PUT /{PHONE_NUMBER_ID}/messages
Body: { "messaging_product": "whatsapp", "status": "read", "message_id": "wamid.INCOMING_MSG_ID" }
```

### 4.19 Typing Indicator + Read Receipt
```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.MSG_ID",
  "typing_indicator": { "type": "text" }
}
```

### 4.20 Block Users
```json
{
  "messaging_product": "whatsapp",
  "block_users": [{ "user": "PHONE" }]
}
```

---

## 5. TEMPLATE MESSAGES (Sending)

### 5.1 Simple Template (no variables)
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": { "code": "en_US" }
  }
}
```

### 5.2 Template with Body Variables
```json
{
  "messaging_product": "whatsapp",
  "to": "PHONE",
  "type": "template",
  "template": {
    "name": "order_update",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John" },
          { "type": "text", "text": "ORD-12345" },
          { "type": "currency", "currency": { "fallback_value": "₹999.00", "code": "INR", "amount_1000": 999000 } },
          { "type": "date_time", "date_time": { "fallback_value": "March 1, 2026" } }
        ]
      }
    ]
  }
}
```

### 5.3 Template with Media Header + Body Variables
```json
{
  "template": {
    "name": "promo_offer",
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
          { "type": "text", "text": "John" },
          { "type": "text", "text": "50%" }
        ]
      }
    ]
  }
}
```

### 5.4 Template with Quick Reply Buttons
```json
{
  "template": {
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "Mr. Jones" }] },
      { "type": "button", "sub_type": "quick_reply", "index": 0, "parameters": [{ "type": "text", "text": "Yes" }] },
      { "type": "button", "sub_type": "quick_reply", "index": 1, "parameters": [{ "type": "text", "text": "No" }] }
    ]
  }
}
```

### 5.5 Template with Flow Button
```json
{
  "template": {
    "name": "survey_template",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "button",
        "sub_type": "flow",
        "index": "0",
        "parameters": [{
          "type": "action",
          "action": {
            "flow_token": "FLOW_TOKEN",
            "flow_action_data": { "custom_key": "custom_value" }
          }
        }]
      }
    ]
  }
}
```

### 5.6 Template with Catalog Button
```json
{
  "template": {
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "100" }] },
      {
        "type": "button", "sub_type": "CATALOG", "index": 0,
        "parameters": [{ "type": "action", "action": { "thumbnail_product_retailer_id": "SKU_ID" } }]
      }
    ]
  }
}
```

---

## 6. TEMPLATE MANAGEMENT (CRUD)

### Get All Templates
```
GET /{WABA_ID}/message_templates
```

### Get Template by Name
```
GET /{WABA_ID}/message_templates?name=TEMPLATE_NAME
```

### Get Template by ID
```
GET /{TEMPLATE_ID}
```

### Delete Template by Name
```
DELETE /{WABA_ID}/message_templates?name=TEMPLATE_NAME
```

### Delete Specific Template by ID
```
DELETE /{WABA_ID}/message_templates?hsm_id=HSM_ID&name=NAME
```

### Create Template — Standard (Text Header + Quick Reply)
```json
POST /{WABA_ID}/message_templates
{
  "name": "seasonal_promotion",
  "language": "en",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Our {{1}} is on!", "example": { "header_text": ["Summer Sale"] } },
    { "type": "BODY", "text": "Shop now through {{1}} and use code {{2}} to get {{3}} off.", "example": { "body_text": [["end of August", "25OFF", "25%"]] } },
    { "type": "FOOTER", "text": "Manage your subscriptions below" },
    { "type": "BUTTONS", "buttons": [
      { "type": "QUICK_REPLY", "text": "Unsubscribe from Promos" },
      { "type": "QUICK_REPLY", "text": "Unsubscribe from All" }
    ]}
  ]
}
```

### Create Template — Image Header + CTA Buttons
```json
{
  "name": "limited_time_offer",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "IMAGE", "example": { "header_handle": ["4::aW..."] } },
    { "type": "BODY", "text": "Hi {{1}}! Get our {{2}} for as low as {{3}}.", "example": { "body_text": [["Mark", "Tuscan Getaway", "800"]] } },
    { "type": "FOOTER", "text": "Offer valid until May 31" },
    { "type": "BUTTONS", "buttons": [
      { "type": "PHONE_NUMBER", "text": "Call", "phone_number": "15550051310" },
      { "type": "URL", "text": "Shop Now", "url": "https://example.com/shop?promo={{1}}", "example": ["summer2023"] }
    ]}
  ]
}
```

### Create Template — Document Header
```json
{
  "name": "order_confirmation",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    { "type": "HEADER", "format": "DOCUMENT", "example": { "header_handle": ["4::handle..."] } },
    { "type": "BODY", "text": "Thank you {{1}}! Order #{{2}}. Tap PDF above for receipt.", "example": { "body_text": [["Mark", "860198-230332"]] } },
    { "type": "BUTTONS", "buttons": [
      { "type": "PHONE_NUMBER", "text": "Call", "phone_number": "16467043595" },
      { "type": "URL", "text": "Contact Support", "url": "https://example.com/support" }
    ]}
  ]
}
```

### Create Template — Location Header
```json
{
  "name": "delivery_update",
  "language": "en_US",
  "category": "UTILITY",
  "components": [
    { "type": "HEADER", "format": "LOCATION" },
    { "type": "BODY", "text": "Good news {{1}}! Order #{{2}} is on its way.", "example": { "body_text": [["Mark", "566701"]] } },
    { "type": "FOOTER", "text": "Tap below to stop updates." },
    { "type": "BUTTONS", "buttons": [{ "type": "QUICK_REPLY", "text": "Stop Updates" }] }
  ]
}
```

### Create Template — Authentication (OTP Copy Code)
```json
{
  "name": "auth_otp_copy",
  "language": "en_US",
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 10 },
    { "type": "BUTTONS", "buttons": [{ "type": "OTP", "otp_type": "COPY_CODE", "text": "Copy Code" }] }
  ]
}
```

### Create Template — Authentication (One-Tap Autofill)
```json
{
  "name": "auth_otp_autofill",
  "language": "en_US",
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 10 },
    { "type": "BUTTONS", "buttons": [{
      "type": "OTP", "otp_type": "ONE_TAP", "text": "Copy Code",
      "autofill_text": "Autofill", "package_name": "com.example.app", "signature_hash": "K8a%2FAINcGX7"
    }] }
  ]
}
```

### Create Template — Catalog
```json
{
  "name": "catalog_offer",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "BODY", "text": "Shop on WhatsApp! Get Rs {{1}} off orders above {{2}}Rs!", "example": { "body_text": [["100", "400", "3"]] } },
    { "type": "FOOTER", "text": "Best deals on WhatsApp!" },
    { "type": "BUTTONS", "buttons": [{ "type": "CATALOG", "text": "View catalog" }] }
  ]
}
```

### Create Template — Multi-Product (MPM)
```json
{
  "name": "abandoned_cart",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "HEADER", "format": "TEXT", "text": "Forget something {{1}}?", "example": { "header_text": ["Pablo"] } },
    { "type": "BODY", "text": "Use code {{1}} for 10% off!", "example": { "body_text": [["10OFF"]] } },
    { "type": "BUTTONS", "buttons": [{ "type": "MPM", "text": "View items" }] }
  ]
}
```

### Create Template — Flow Button (by name)
```json
{
  "name": "survey_template",
  "language": "en_US",
  "category": "MARKETING",
  "components": [
    { "type": "body", "text": "Complete our survey" },
    { "type": "BUTTONS", "buttons": [{
      "type": "FLOW", "text": "Start Survey",
      "flow_name": "my_flow", "navigate_screen": "SCREEN_1", "flow_action": "navigate"
    }] }
  ]
}
```

### Create Template — Flow Button (by ID)
```json
{
  "type": "BUTTONS", "buttons": [{
    "type": "FLOW", "text": "Open Form",
    "flow_id": "FLOW_ID", "navigate_screen": "SCREEN_1", "flow_action": "navigate"
  }]
}
```

### Create Template — Flow Button (inline JSON)
```json
{
  "type": "BUTTONS", "buttons": [{
    "type": "FLOW", "text": "Open Form",
    "flow_json": "{\"version\":\"5.0\",\"screens\":[{\"id\":\"WELCOME_SCREEN\",\"layout\":{\"type\":\"SingleColumnLayout\",\"children\":[{\"type\":\"TextHeading\",\"text\":\"Hello World\"},{\"type\":\"Footer\",\"label\":\"Complete\",\"on-click-action\":{\"name\":\"complete\",\"payload\":{}}}]},\"title\":\"Welcome\",\"terminal\":true,\"success\":true,\"data\":{}}]}",
    "navigate_screen": "WELCOME_SCREEN", "flow_action": "navigate"
  }]
}
```

### Edit Template
```
POST /{TEMPLATE_ID}
Body: same structure as create, with updated components
```

---

## 7. MEDIA

### Upload Media
```
POST /{PHONE_NUMBER_ID}/media
Content-Type: multipart/form-data
Body: file=@local_file.ogg, messaging_product=whatsapp
→ { "id": "MEDIA_ID" }
```

### Get Media URL
```
GET /{MEDIA_ID}
→ { "url": "https://...", "mime_type": "...", "sha256": "...", "file_size": 12345, "id": "MEDIA_ID" }
```

### Download Media
```
GET {media_url}
Headers: Authorization: Bearer {TOKEN}
→ binary file content
```

---

## 8. BUSINESS PROFILE

### Update Business Profile
```
POST /{PHONE_NUMBER_ID}/whatsapp_business_profile
{
  "messaging_product": "whatsapp",
  "address": "123 Business St",
  "description": "We sell great products",
  "vertical": "RETAIL",
  "about": "Official Business Account",
  "email": "hello@example.com",
  "websites": ["https://example.com"],
  "profile_picture_handle": "IMAGE_HANDLE_ID"
}
```

---

## 9. QR CODES

### Create QR Code
```
POST /{PHONE_NUMBER_ID}/message_qrdls
Body: { "prefilled_message": "Hi, I want to learn more", "generate_qr_image": "SVG" }
```

### Update QR Code
```
POST /{PHONE_NUMBER_ID}/message_qrdls
Body: { "prefilled_message": "Updated message", "code": "QR_CODE" }
```

### Get QR Codes
```
GET /{PHONE_NUMBER_ID}/message_qrdls
```

### Delete QR Code
```
DELETE /{PHONE_NUMBER_ID}/message_qrdls/{QR_CODE_ID}
```

---

## 10. WEBHOOK SUBSCRIPTIONS

### Subscribe to WABA Webhooks
```
POST /{WABA_ID}/subscribed_apps
```

### Get All Subscriptions
```
GET /{WABA_ID}/subscribed_apps
```

### Unsubscribe
```
DELETE /{WABA_ID}/subscribed_apps
```

### Override Callback URL (per WABA)
```
POST /{WABA_ID}/subscribed_apps
Body: { "override_callback_uri": "https://your-webhook.com/webhook", "verify_token": "YOUR_VERIFY_TOKEN" }
```
