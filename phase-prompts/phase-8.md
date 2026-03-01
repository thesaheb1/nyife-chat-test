# Phase 8: Frontend — User Dashboard (React)

Read CLAUDE.md frontend section. This is Phase 8. The entire backend is complete. Now build the React frontend.

**CRITICAL:** Split this phase into sub-phases if context gets tight. Do one module at a time.

---

## Task 8.0 — Frontend Scaffold

Create `frontend/` with Vite + React + TypeScript setup:

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── core/
│   │   ├── api/                  # Axios instance, interceptors (auto-refresh token)
│   │   ├── router/               # React Router config with auth guards + RBAC guards
│   │   ├── store/                # Redux Toolkit store (auth slice, ui slice)
│   │   ├── providers/            # QueryClientProvider, ReduxProvider, SocketProvider, ThemeProvider, I18nProvider
│   │   ├── hooks/                # useAuth, useSocket, usePermissions, useDebounce
│   │   └── types/                # Global TypeScript interfaces
│   ├── shared/
│   │   ├── components/           # Reusable: DataTable, Modal, ConfirmDialog, FileUpload, SearchInput, DateRangePicker, StatusBadge, Pagination, EmptyState, LoadingSkeleton
│   │   ├── layouts/              # AppLayout (sidebar + topbar + content), AuthLayout (centered card)
│   │   └── utils/                # formatCurrency, formatDate, formatPhone, downloadFile
│   └── modules/
│       ├── auth/
│       ├── dashboard/
│       ├── contacts/
│       ├── templates/
│       ├── campaigns/
│       ├── chat/
│       ├── automations/
│       ├── organizations/
│       ├── support/
│       ├── wallet/
│       ├── settings/
│       └── developer/
├── public/
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
├── nginx.conf                   # Production Nginx config (SPA fallback, API proxy)
└── package.json
```

### Setup:
- Vite + React 18 + TypeScript
- Install: shadcn/ui (init), Tailwind CSS, lucide-react, @tanstack/react-query, @reduxjs/toolkit, react-redux, react-router-dom, react-hook-form, zod, @hookform/resolvers, axios, socket.io-client, recharts, @tanstack/react-table, react-i18next, i18next, sonner (toast)
- Axios interceptor: attach JWT, auto-refresh on 401, redirect to login on refresh failure
- React Query: default staleTime 30s, retry 1
- Socket.IO: connect on auth, disconnect on logout, namespaces for chat + notifications
- Theme: light/dark/system support via Tailwind + CSS variables
- i18n: en as default, lazy-load translations

---

## Task 8.1 — Auth Module (`modules/auth/`)
Pages: Login, Register, ForgotPassword, ResetPassword, VerifyEmail
- Login: email + password form, social login buttons (Google, Facebook — shown based on admin SSO settings fetched from public API), "Forgot password?" link
- Register: multi-step or single form (name, email, phone, password, confirm), terms checkbox
- After login: store accessToken in memory (Redux), refreshToken in httpOnly cookie (handled by backend)
- Auth guard HOC/route: redirect to login if not authenticated
- Fetch user profile on app load, store in Redux

## Task 8.2 — App Layout (`shared/layouts/`)
- **Sidebar:** Collapsible, shows navigation based on user role + permissions. Items: Dashboard, Contacts, Templates, Campaigns, Chat (with unread badge), Automations, Organizations, Support, Wallet, Settings, Developer Tools. Active state highlighting. Mobile: sheet/drawer.
- **Topbar:** Search (global), notification bell (with unread count badge + dropdown), user avatar dropdown (profile, settings, logout), wallet balance chip, theme toggle
- **Breadcrumbs:** Auto-generated from route

## Task 8.3 — Dashboard Module (`modules/dashboard/`)
- Summary cards: Total Contacts, Total Templates (approved/pending/rejected), Active Campaigns, Unread Chats, Wallet Balance, Subscription Plan + usage progress bars
- Charts: Messages timeline (last 30 days — sent vs delivered vs read), Campaign performance pie chart
- Quick actions: New Campaign, New Contact, New Template, View Chat
- Recent activity list (latest messages, campaigns, support tickets)
- Date range filter for all analytics

## Task 8.4 — Contacts Module (`modules/contacts/`)
Pages: ContactList, ContactDetail, ImportCSV, Tags, Groups, GroupDetail
- **ContactList:** DataTable with columns (name, phone, email, tags, source, last_messaged, created). Search bar, tag filter (multi-select), group filter, date range. Bulk actions: delete, add to group, add tag. "Add Contact" button opens modal/drawer.
- **ContactDetail:** Full profile, tags (add/remove chips), groups, message history link, edit form
- **ImportCSV:** Upload zone, preview parsed data in table, map columns, validate, show import results
- **Tags:** List with color indicators, create/edit inline, delete with confirmation
- **Groups:** List with member count, create/edit, group detail page with member list (add/remove)

## Task 8.5 — Templates Module (`modules/templates/`)
Pages: TemplateList, CreateTemplate, TemplateDetail
- **TemplateList:** DataTable with status badges (draft/pending/approved/rejected), type icons, category, actions (edit/delete/publish)
- **CreateTemplate:** Multi-step form OR tabbed form:
  1. Basic info: name, category, language, type selection
  2. Component builder — **different UI per type:**
     - Standard: header (text/media), body (textarea with variable insertion buttons {{1}}, {{2}}), footer, buttons (quick_reply/url/phone)
     - Authentication: OTP template builder, copy_code or one_tap button
     - Carousel: Card builder (add/remove cards, each with media + body + buttons), preview carousel
     - Flow: Select flow_id, action, body, trigger button
     - List Menu: Body, button text, section builder (add sections with rows)
  3. Preview: WhatsApp-style bubble preview of the template
  4. Submit: Publish to Meta for review
- **TemplateDetail:** Full template view with status history, preview, edit (if draft), publish button

## Task 8.6 — Campaigns Module (`modules/campaigns/`)
Pages: CampaignList, CreateCampaign, CampaignDetail
- **CampaignList:** DataTable with status, template name, recipients, sent/delivered/failed counts, cost, actions
- **CreateCampaign:** Wizard steps:
  1. Select WhatsApp account
  2. Select approved template
  3. Select audience: choose group(s), select contacts, filter by tags, or all contacts
  4. Map variables: UI to map template {{1}}, {{2}} → contact fields (name, phone, email, custom_field.X)
  5. Review: show estimated recipients + estimated cost
  6. Send now or schedule
- **CampaignDetail:** Real-time stats (Socket.IO): progress bar, sent/delivered/read/failed counters with live updates. Charts. Message-level table with status per contact. Retry button for failed messages. Cost breakdown.

## Task 8.7 — Chat Module (`modules/chat/`)
**This is the most interactive module. Build it carefully.**

Split layout: conversation list (left sidebar) + active conversation (right panel).
- **Conversation List:** Search, filter by status/assigned, each item shows: contact name/phone, last message preview (truncated), timestamp, unread badge, assigned avatar. Sorted by last_message_at. Real-time updates via Socket.IO.
- **Active Conversation:** 
  - Header: contact name, phone, assign button, close button
  - Message area: scrollable, auto-scroll to bottom on new message, load older on scroll up. Render all message types (text, image, video, audio, document, location, contact, interactive, template). Inbound on left, outbound on right. Status indicators (sent ✓, delivered ✓✓, read ✓✓ blue, failed ✗).
  - Input area: text input, attachment button (image/video/audio/document), template send button (opens template selector), emoji picker, send button
  - Typing indicator
  - All real-time via Socket.IO

## Task 8.8 — Remaining Modules (implement each fully):

**Automations:** List automations with status toggle, create/edit form with trigger + action config, logs table
**Organizations:** List orgs, create org, org detail with team member management (invite, edit permissions, remove)
**Support:** Create ticket form, ticket list, ticket detail with reply thread, rate resolved tickets
**Wallet:** Balance display, recharge button (Razorpay checkout integration), transaction history table with filters, invoice list with download
**Settings:** Tabbed settings page: Profile, Language, Notifications, Theme, WhatsApp Profiles (list connected accounts), Plugins/Integrations
**Developer Tools:** API token management (create, list, revoke), API documentation page with code samples in tabs (Node.js, PHP, Python, Java, Ruby) for each message type

## Completion Criteria
- [ ] All pages implemented and connected to backend APIs
- [ ] React Query for all server state (no manual fetching)
- [ ] Redux for auth state + UI state (sidebar, theme)
- [ ] All forms use React Hook Form + Zod validation
- [ ] All tables use TanStack Table with sorting, filtering, pagination
- [ ] Socket.IO connected for chat + notifications + campaign status
- [ ] i18n wired up with at least English translations
- [ ] Dark/light theme works
- [ ] Responsive: works on mobile + desktop
- [ ] Loading states, empty states, error states everywhere
- [ ] Razorpay checkout integration for wallet recharge + subscription
