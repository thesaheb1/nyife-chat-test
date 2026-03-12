# Admin Panel Module Inventory and User Module Checklist

## Status Legend
- `[x]` Implemented now
- `[-]` Partially implemented or inconsistent
- `[ ]` Missing
- `[!]` Major change that should be discussed before implementation

## Current Admin Panel Module Inventory

### Implemented admin modules
- `[x]` Dashboard
  - Aggregated revenue, users, subscriptions, support, messages, templates, campaigns, WhatsApp counts
  - Charts for revenue, user growth, message volume, subscription mix
- `[x]` Users
  - User list
  - Direct user creation with password
  - User detail page
  - Status update
  - Wallet credit and debit
  - Transactions, subscriptions, invoices
  - Delete with basic safety checks
- `[x]` Plans
  - Plan CRUD
  - Plan status update
  - Coupons CRUD
- `[x]` Support
  - Ticket list
  - Ticket detail
  - Reply
  - Assign
  - Status update
- `[x]` Sub-admins
  - Direct sub-admin creation
  - Invite sub-admin by email
  - Invitation validate and accept
  - Delete sub-admin
- `[x]` Roles
  - Create, list, update, delete admin roles
  - Shared permission matrix already exists
- `[x]` Notifications
  - Broadcast creation and listing
- `[x]` Email
  - Admin email sending screen
- `[x]` Settings
  - Settings read and update

### Modules not yet present as dedicated admin modules
- `[ ]` Organizations module
- `[ ]` Teams or Team Members module
- `[ ]` Dedicated Analytics module page
- `[ ]` Site-content or site-module management beyond plans, email, notifications, settings

## User Module: Verified Current Behavior

### Frontend
- `[x]` User list page exists
- `[x]` Columns currently shown: name, email, role, status, plan, wallet, joined date, actions
- `[x]` Phone number column is shown in the table
- `[x]` List search box exists
- `[x]` Search placeholder covers name, email, phone, organization, and team-member search
- `[x]` Status filter exists
- `[x]` Plan filter is present in UI
- `[x]` Date range filter is present in UI
- `[x]` Actions currently available in dropdown:
  - View dashboard
  - Edit user
  - View wallet
  - View plan
  - View organizations
  - View team members
  - Update status
  - Delete
- `[x]` Create user page exists
- `[x]` Create user page supports direct create and invite flows
- `[x]` Create user page is limited to platform-user creation only
- `[x]` User detail page exists
- `[x]` User detail page is a selected-organization dashboard
- `[x]` User detail page exposes organization selection
- `[x]` User detail page exposes organizations list
- `[x]` User detail page exposes team members by organization
- `[x]` User detail page exposes support tickets
- `[x]` User detail page exposes analytics by selected organization
- `[x]` Edit user modal exists

### Backend
- `[x]` `GET /api/v1/admin/users` exists
- `[x]` `GET /api/v1/admin/users/:id` exists
- `[x]` `POST /api/v1/admin/users` exists
- `[x]` `PUT /api/v1/admin/users/:id/status` exists
- `[x]` `DELETE /api/v1/admin/users/:id` exists
- `[x]` Wallet admin credit and debit endpoints exist
- `[x]` Transactions, subscriptions, and invoices endpoints exist
- `[x]` `GET /api/v1/admin/users` supports `search`, `status`, `plan`, `date_from`, and `date_to`
- `[x]` `GET /api/v1/admin/users` implements advanced search across organizations and team members
- `[x]` Admin invite-by-email flow exists for platform users
- `[x]` Update user endpoints exist for name, email, phone, and avatar
- `[x]` Admin dashboard endpoint returns organizations and selected-organization summary
- `[x]` Team members can be listed for a selected organization
- `[x]` Selected-organization user dashboard endpoint exists
- `[x]` User detail/dashboard contracts are aligned around top-level dashboard data
- `[x]` Delete safety checks are organization-aware across wallet balances and subscriptions

## Requested User Module Scope

### Table and actions
- `[x]` Add phone number column to the user table
- `[x]` Add action: view details as a complete user dashboard
- `[x]` Add action: create user with two flows
  - invite by email
  - direct create with default password
- `[x]` Add action: edit user
  - first name
  - last name
  - email
  - phone number
  - display picture or avatar
- `[x]` Add action: update status
- `[x]` Add action: view plan from selected organization
- `[x]` Add action: view wallet from selected organization
- `[x]` Add action: view organizations
- `[x]` Add action: view team members from selected organization
- `[x]` Add action: delete user only when all wallets are zero and there is no active subscription in any organization

### Search and filters
- `[x]` Advanced search by user name, email, phone
- `[x]` Advanced search by organization name
- `[x]` Advanced search by team member name, email, phone
- `[x]` Filter by status
- `[x]` Filter by plan
- `[x]` Filter by joined date range

## Gaps and Recommended Build Scope

### Safe and straightforward changes
- `[x]` Add phone number column to the existing user list
- `[x]` Add plan and date range filters to the list UI
- `[x]` Align list and detail response types so frontend and backend contracts match
- `[x]` Remove `admin` role creation from the user module if sub-admin management remains the correct path for admin accounts

### Medium changes
- `[x]` Add an edit-user API and UI with validation for first name, last name, email, phone, and avatar
- `[x]` Add organization selector to the user detail screen
- `[x]` Add organization-scoped wallet, subscription, and invoice reads
- `[x]` Add organization and team-member drilldown screens from the user module
- `[x]` Add support-ticket tab on user details using the existing admin support endpoint for user tickets

### Major changes that need discussion first
- `[x]` Admin-created platform user invitation flow
  - Implemented with a dedicated admin-user invitation model, email template, and public accept flow
- `[x]` Complete user dashboard by selected organization
  - Implemented with organization-scoped wallet, plans, team members, support, and analytics sections
- `[x]` Advanced search across user, organization, and team-member fields
  - Implemented server-side in admin-service with organization and team-member joins
- `[x]` Deletion rule across all organizations
  - Implemented with cross-organization wallet and active or pending subscription guards
- `[x]` Avatar or display-picture editing
  - Implemented through direct avatar upload, replacement, and removal via media-service proxy

## Proposed Verification Checklist For User Module

### List page
- `[ ]` User table shows phone number
- `[ ]` Search works for name, email, and phone
- `[ ]` Search works for organization name
- `[ ]` Search works for team-member name, email, and phone
- `[ ]` Status filter works
- `[ ]` Plan filter works
- `[ ]` Date range filter works
- `[ ]` Action dropdown contains all required actions

### Create user
- `[ ]` Super admin or authorized sub-admin can invite a user by email
- `[ ]` Invitation email opens the correct frontend URL
- `[ ]` Invited user can set password and reach login
- `[ ]` Super admin or authorized sub-admin can create a user with a default password
- `[ ]` New user gets default organization setup correctly

### Edit user
- `[ ]` Name validation works
- `[ ]` Email validation works
- `[ ]` Phone validation works
- `[ ]` Avatar validation and upload works
- `[ ]` Updated values appear in list and detail views

### User details
- `[ ]` User dashboard loads with first organization selected by default
- `[ ]` Organization selector changes wallet, plan, team members, and related data
- `[ ]` Organizations list is visible
- `[ ]` Team members for selected organization are visible
- `[ ]` Support tickets for the user are visible
- `[ ]` Analytics section is visible if included in scope

### Wallet and plans
- `[ ]` Wallet view shows current balance for selected organization
- `[ ]` Wallet history shows transactions for selected organization
- `[ ]` Plan view shows active plan for selected organization
- `[ ]` Plan history shows past subscriptions
- `[ ]` Transactions and subscription details are accurate per organization

### Status and deletion
- `[ ]` Status update works from list page
- `[ ]` Status update works from detail page
- `[ ]` Delete is blocked when any organization wallet balance is non-zero
- `[ ]` Delete is blocked when any organization has an active subscription
- `[ ]` Delete succeeds only when all delete safety conditions are satisfied

## Decisions Needed Before Implementation

1. User invite flow
   - Should admin-created user invites use a dedicated admin invitation flow, or should they reuse an existing auth invitation or reset-password flow?

   ANS: you can use existing flow by making more dynamic, flexible, modular and reusable. so flow used everywhere in platform.

2. User dashboard scope
   - For the first version, do you want wallet, plans, organizations, team members, and support only, or do you also want analytics in the same first release?

   ANS : you can add analytics in the same first release.

3. Search scope
   - Is advanced search expected to be global and instant on the main user table, or is a slower admin-only server search acceptable for version one?

   ANS : take this decision by your self with recommended approach for production grade app.

4. Delete policy
   - Should "no active plan" include trial subscriptions, paused subscriptions, and scheduled renewals, or only `active` status?

ANS : take this decision by your self with recommended approach for production grade app.

5. Avatar handling
   - Should admin be able to upload a new avatar file directly, or only set or replace an existing media URL through the same media flow used elsewhere?

   ANS : you can upload new avatar file directly and replace/remove existing media url if any.
