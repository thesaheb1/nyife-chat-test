# Phase 9: Frontend — Admin Dashboard (React)

Read CLAUDE.md. Read frontend/ code from Phase 8 to reuse shared components. This is Phase 9.

The admin dashboard is a SEPARATE React app OR a separate route group within the same app (recommended: same app, `/admin/*` routes with admin layout).

---

## Approach: Same App, Admin Routes

Add to existing `frontend/src/modules/admin/` with a separate `AdminLayout` component. Admin guard checks `user.role === 'super_admin' || user.role === 'admin'`. Sidebar items derived from admin permissions.

## Admin Layout
- **Sidebar:** Dynamic based on permissions. Possible items: Dashboard, Users, Plans & Coupons, Support Desk, Sub Admins, Notifications, Email Management, Settings. Only show items the admin has permission for.
- **Topbar:** Admin badge, notification bell, profile dropdown

## Admin Modules:

### Admin Dashboard (`modules/admin/dashboard/`)
- Revenue cards: today, this week, this month, year, total (with % change vs previous period)
- User cards: total, active, new this month
- Subscription distribution chart (pie: monthly/yearly/lifetime)
- Revenue timeline chart (line: daily revenue last 30 days)
- Message volume chart (bar: daily messages last 30 days)
- User growth chart (line: cumulative users over time)
- Open support tickets count + avg resolution time
- Date range filter for all charts
- Quick stats: total wallet balances, pending templates, active campaigns

### User Management (`modules/admin/users/`)
- **UserList:** DataTable with advanced search (name, email, phone), filters (status, plan type, date range), pagination. Columns: name, email, phone, plan, status, wallet balance, created_at, actions.
- **UserDetail:** Tabbed view:
  - Overview: profile info, current plan + usage, wallet balance, account status toggle
  - Organizations: list with team member counts
  - Subscriptions: history table
  - Transactions: history table with filters
  - Invoices: list with download
  - Support tickets: list for this user
  - Actions: credit/debit wallet (modal with amount + remarks), activate/deactivate, delete (with validation checks)
- **CreateUser:** Form to create user on behalf (name, email, phone, password)

### Plans Management (`modules/admin/plans/`)
- Plan list with sort order
- Create/Edit plan form: all fields from sub_plans table, organized in sections (basic info, limits, pricing, features)
- Activate/deactivate toggle
- **Coupons:** Sub-tab or sub-page. Coupon list, create/edit form (code, discount type/value, validity, max uses, applicable plans/users)

### Support Desk (`modules/admin/support/`)
- Ticket list: advanced filters (status, priority, category, assigned_to, user search, date range)
- Ticket detail: user info sidebar, reply thread, assign dropdown, status change dropdown, priority change
- Quick reply templates

### Sub Admin Management (`modules/admin/sub-admins/`)
- Sub admin list with role, status, last login
- Create sub admin form: personal details + role selection
- **Role Management:** Create/edit roles with permission matrix UI:
  - Resources as rows (Users, Dashboard, Plans, Support, Notifications, Emails, Settings, Sub Admins)
  - Permissions as columns (Create, Read, Update, Delete)
  - Checkbox grid — very clear visual
  
### Notifications (`modules/admin/notifications/`)
- Send notification form: title, body, target (all users / specific users with search+select)
- Option to also send email
- Sent notifications list with delivery stats

### Email Management (`modules/admin/emails/`)
- Email template list: edit HTML content with simple editor (or textarea with preview)
- Send email form: to (single/multiple), subject, body or template + variables
- Sent email list with status

### Settings (`modules/admin/settings/`)
Tabbed settings page (each tab = one settings group):
- **General:** Site name, URL, logo upload, company info
- **SEO:** Meta title, description, keywords, OG image
- **Timezone & Currency:** Dropdowns
- **SSO:** Google OAuth (client ID, secret, toggle), Facebook (app ID, secret, toggle)
- **Payment:** Razorpay (key, secret, webhook secret, toggle)
- **Tax:** Enable/disable, type, rate, inclusive/exclusive toggle
- **SMTP:** Host, port, user, password, from email, from name, "Send Test Email" button
- **Frontend Pages:** Rich text editor (or markdown) for privacy policy, terms, refund policy
- **Billing Info:** Company details for invoices
- **Languages:** Default language, available languages toggle

## Completion Criteria
- [ ] All admin pages implemented and connected to admin-service APIs
- [ ] Admin RBAC enforced: sidebar + route guards + API calls
- [ ] Permission matrix UI works for role creation
- [ ] User wallet credit/debit from admin works
- [ ] All settings groups save and load correctly
- [ ] Support desk with assignment and reply works
- [ ] Admin dashboard charts render with real data
