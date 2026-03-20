// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

// Auth
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'team' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notification_email: boolean;
  notification_push: boolean;
  notification_in_app: boolean;
}

export interface ApiToken {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
  created_at: string;
}

// Contacts
export interface Contact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown> | null;
  whatsapp_name: string | null;
  opted_in: boolean;
  opted_in_at: string | null;
  last_messaged_at: string | null;
  message_count: number;
  source: 'manual' | 'csv_import' | 'whatsapp_incoming' | 'api';
  tags?: Tag[];
  groups?: Group[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contact_count: number;
  type: 'static' | 'dynamic';
  dynamic_filters: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GroupDetailResult {
  group: Group;
  members: Contact[];
  meta: PaginationMeta;
}

export interface ContactImportResult {
  total: number;
  created: number;
  restored?: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number | null; phone: string; reason: string }>;
}

export interface GroupImportResult {
  total: number;
  groups_created: number;
  contacts_created: number;
  contacts_restored: number;
  contacts_updated: number;
  memberships_added: number;
  skipped: number;
  errors: Array<{ row: number | null; phone: string; reason: string }>;
}

// Templates
export interface Template {
  id: string;
  user_id: string;
  waba_id: string | null;
  wa_account_id: string | null;
  source?: 'nyife' | 'meta_sync' | null;
  name: string;
  display_name: string | null;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  type: 'standard' | 'authentication' | 'carousel' | 'flow' | 'list_menu';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused' | 'disabled';
  components: unknown[];
  example_values: Record<string, unknown> | null;
  rejection_reason: string | null;
  meta_template_id: string | null;
  available_actions?: Array<'view' | 'edit' | 'publish' | 'sync' | 'delete'>;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FlowCategory =
  | 'LEAD_GENERATION'
  | 'LEAD_QUALIFICATION'
  | 'APPOINTMENT_BOOKING'
  | 'SLOT_BOOKING'
  | 'ORDER_PLACEMENT'
  | 'RE_ORDERING'
  | 'CUSTOMER_SUPPORT'
  | 'TICKET_CREATION'
  | 'PAYMENTS'
  | 'COLLECTIONS'
  | 'REGISTRATIONS'
  | 'APPLICATIONS'
  | 'DELIVERY_UPDATES'
  | 'ADDRESS_CAPTURE'
  | 'FEEDBACK'
  | 'SURVEYS'
  | 'OTHER';

export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

export type FlowComponentType =
  | 'TextHeading'
  | 'TextSubheading'
  | 'TextBody'
  | 'TextInput'
  | 'TextArea'
  | 'Dropdown'
  | 'RadioButtonsGroup'
  | 'CheckboxGroup'
  | 'DatePicker'
  | 'Image'
  | 'Footer';

export interface FlowOption {
  id: string;
  title: string;
  description?: string;
  value?: string | number | boolean;
}

export interface FlowFooterAction {
  type: 'complete' | 'navigate';
  target_screen_id?: string;
  payload?: Record<string, unknown>;
}

export interface FlowComponent {
  type: FlowComponentType;
  name?: string;
  text?: string;
  label?: string;
  helper_text?: string;
  placeholder?: string;
  required?: boolean;
  min_length?: number;
  max_length?: number;
  default_value?: unknown;
  options?: FlowOption[];
  min_selections?: number;
  max_selections?: number;
  image_url?: string;
  caption?: string;
  action?: FlowFooterAction;
  metadata?: Record<string, unknown>;
}

export interface FlowScreen {
  id: string;
  title: string;
  terminal?: boolean;
  refresh_on_back?: boolean;
  success_message?: string;
  data_source?: Record<string, unknown>;
  layout: {
    type: string;
    children: FlowComponent[];
  };
}

export interface FlowDefinition {
  version: string;
  data_api_version?: string;
  routing_model?: Record<string, string[]>;
  screens: FlowScreen[];
}

export interface WhatsAppFlow {
  id: string;
  user_id: string;
  waba_id: string | null;
  wa_account_id: string | null;
  meta_flow_id: string | null;
  name: string;
  categories: FlowCategory[];
  status: FlowStatus;
  json_version: string;
  json_definition: FlowDefinition;
  editor_state: Record<string, unknown> | null;
  data_exchange_config: Record<string, unknown> | null;
  preview_url: string | null;
  validation_errors: string[];
  has_local_changes: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlowSubmission {
  id: string;
  user_id: string;
  flow_id: string;
  meta_flow_id: string;
  contact_phone: string;
  contact_id: string | null;
  wa_account_id: string;
  flow_token: string | null;
  screen_id: string | null;
  submission_data: Record<string, unknown>;
  raw_payload: Record<string, unknown> | null;
  automation_status: string;
  created_at: string;
  updated_at: string;
  flow?: WhatsAppFlow;
}

// Campaigns
export interface Campaign {
  id: string;
  user_id: string;
  wa_account_id: string;
  name: string;
  description: string | null;
  template_id: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  type: 'immediate' | 'scheduled';
  target_type: 'group' | 'contacts' | 'tags' | 'all';
  target_config: Record<string, unknown>;
  variables_mapping: Record<string, string> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  pending_count: number;
  estimated_cost: number;
  actual_cost: number;
  error_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  contact_phone: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  meta_message_id: string | null;
  variables: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  cost: number;
  retry_count: number;
  created_at: string;
}

// Chat
export interface Conversation {
  id: string;
  user_id: string;
  wa_account_id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  assigned_member: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  status: 'open' | 'closed' | 'pending';
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'contact' | 'user' | 'team_member' | 'system';
  sender_id: string | null;
  type: string;
  content: Record<string, unknown>;
  meta_message_id: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

// WhatsApp
export interface WaAccount {
  id: string;
  user_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  verified_name: string | null;
  business_id: string | null;
  credential_source: 'provider_system_user' | 'legacy_embedded_user_token';
  assigned_system_user_id: string | null;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | null;
  name_status: string | null;
  number_status: string | null;
  code_verification_status: string | null;
  account_review_status: string | null;
  messaging_limit: string | null;
  platform_type?: string | null;
  status: 'active' | 'inactive' | 'restricted' | 'banned';
  app_subscription_status: 'unknown' | 'subscribed' | 'not_subscribed' | 'failed';
  credit_sharing_status: 'unknown' | 'not_required' | 'attached' | 'failed';
  onboarding_status: 'pending' | 'in_progress' | 'active' | 'failed' | 'needs_reconcile' | 'inactive';
  last_health_checked_at: string | null;
  last_onboarded_at: string | null;
  last_onboarding_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmbeddedSignupPreviewAccount {
  waba_id: string;
  phone_number_id: string;
  display_phone: string | null;
  verified_name: string | null;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | null;
  already_connected: boolean;
  eligible: boolean;
  eligibility_reason?: 'already_connected' | 'organization_waba_locked' | null;
  existing_account_id: string | null;
  onboarding_status: WaAccount['onboarding_status'] | null;
  credential_source: WaAccount['credential_source'] | null;
}

export interface EmbeddedSignupProviderReadiness {
  provider_configured: boolean;
  system_user_id: string | null;
  provider_business_id: string | null;
  legacy_token_fallback_enabled: boolean;
  redis_backed_session: boolean;
  credit_sharing_enabled: boolean;
  override_callback_url_configured: boolean;
  warnings: string[];
}

export interface EmbeddedSignupPreviewWaba {
  waba_id: string;
  name: string | null;
  phone_count: number;
}

export interface EmbeddedSignupResultStep {
  name: string;
  status: 'skipped' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface EmbeddedSignupResultItem {
  waba_id: string;
  phone_number_id: string;
  status: string;
  steps: EmbeddedSignupResultStep[];
  warnings: string[];
  account: WaAccount | null;
  error?: string;
}

export interface EmbeddedSignupPreviewResult {
  signup_session_id: string;
  business_id: string | null;
  remaining_slots: number | null;
  organization_waba_id: string | null;
  wabas: EmbeddedSignupPreviewWaba[];
  provider_readiness: EmbeddedSignupProviderReadiness;
  accounts: EmbeddedSignupPreviewAccount[];
  warnings?: string[];
}

export interface EmbeddedSignupCompleteResult {
  accounts: WaAccount[];
  connected_count: number;
  warnings: string[];
  results: EmbeddedSignupResultItem[];
  skipped: Array<{
    phone_number_id: string;
    reason: string;
  }>;
}

export interface WaAccountHealthResult {
  account: WaAccount;
  health: {
    provider_configured: boolean;
    assigned_system_user: { id: string } | null;
    app_subscription_status: WaAccount['app_subscription_status'];
    name_status: string | null;
    quality_rating: WaAccount['quality_rating'];
    subscribed_apps_count: number;
    warnings: string[];
  };
}

// Subscriptions
export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: 'monthly' | 'yearly' | 'lifetime';
  price: number;
  currency: string;
  max_contacts: number;
  max_templates: number;
  max_campaigns_per_month: number;
  max_messages_per_month: number;
  max_team_members: number;
  max_organizations: number;
  max_whatsapp_numbers: number;
  has_priority_support: boolean;
  marketing_message_price: number;
  utility_message_price: number;
  auth_message_price: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  starts_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  cancellation_reason?: string | null;
  payment_id?: string | null;
  payment_method?: 'free' | 'wallet' | 'razorpay' | null;
  amount_paid: number;
  discount_amount: number;
  tax_amount: number;
  coupon_id?: string | null;
  auto_renew: boolean;
  auto_renew_eligible?: boolean;
  renewal_state?: 'scheduled' | 'disabled' | 'ineligible' | 'grace_period' | 'failed' | 'renewed' | null;
  next_billing_at?: string | null;
  grace_expires_at?: string | null;
  next_renewal_attempt_at?: string | null;
  last_renewal_error?: string | null;
  usage: SubscriptionUsage;
  plan?: Plan;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUsage {
  contacts_used: number;
  templates_used: number;
  campaigns_this_month: number;
  messages_this_month: number;
  team_members_used: number;
  organizations_used: number;
  whatsapp_numbers_used: number;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface CouponValidationResult {
  coupon_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  plan_price: number;
  price_after_discount: number;
}

export interface SubscriptionCheckoutResult {
  subscription: Subscription;
  plan: Plan;
  payment_required: boolean;
  payment_method?: 'free' | 'wallet' | 'razorpay' | null;
  wallet_debited_amount?: number;
  wallet_balance_after?: number | null;
  auto_renew_eligible?: boolean;
  razorpay_order?: RazorpayOrder;
  previous_subscription_id?: string;
}

export interface SubscriptionHistoryResult {
  subscriptions: Subscription[];
  meta: PaginationMeta;
}

export interface PlanDetailsResult {
  plan: Plan;
}

// Wallet
export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  source: 'recharge' | 'message_debit' | 'admin_credit' | 'admin_debit' | 'refund' | 'subscription_payment';
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  remarks: string | null;
  payment_id: string | null;
  payment_status: 'pending' | 'completed' | 'failed';
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  type: 'subscription' | 'recharge' | 'message_charges';
  amount: number;
  tax_amount: number;
  total_amount: number;
  tax_details: Record<string, unknown> | null;
  billing_info: Record<string, unknown> | null;
  status: 'paid' | 'pending' | 'cancelled';
  paid_at: string | null;
  created_at: string;
}

// Organizations
export interface Organization {
  id: string;
  user_id: string;
  owner_user_id?: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  status: 'active' | 'inactive';
  organization_role?: 'owner' | 'team';
  permissions?: Permissions;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  organization_id: string;
  user_id: string;
  member_user_id: string;
  role_title: string;
  permissions: Permissions;
  status: 'active' | 'inactive' | 'invited';
  invited_at: string;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  member?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  };
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  invited_by_user_id: string;
  accepted_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role_title: string;
  permissions: Permissions;
  invite_token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permissions {
  resources: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>;
}

export interface AdminAuthorization {
  user: Pick<User, 'id' | 'email' | 'role' | 'status'>;
  actor_type: 'super_admin' | 'sub_admin';
  is_super_admin: boolean;
  permissions: Permissions;
  role: {
    id?: string;
    title: string;
    permissions: Permissions;
    is_system: boolean;
  } | null;
  sub_admin: {
    id: string;
    role_id: string;
    status: 'active' | 'inactive';
    created_by: string;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
}

// Automations
export interface Automation {
  id: string;
  user_id: string;
  wa_account_id: string;
  name: string;
  description: string | null;
  type: 'basic_reply' | 'advanced_flow' | 'webhook_trigger' | 'api_trigger';
  status: 'active' | 'inactive' | 'draft';
  trigger_config: Record<string, unknown>;
  action_config: Record<string, unknown>;
  priority: number;
  conditions: Record<string, unknown> | null;
  stats: { triggered_count: number; last_triggered_at: string | null };
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  user_id: string;
  trigger_data: Record<string, unknown> | null;
  action_result: Record<string, unknown> | null;
  status: 'success' | 'failed';
  error_message: string | null;
  contact_phone: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string | null;
  headers?: Record<string, string> | null;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  sender_type: 'system' | 'admin';
  type: 'info' | 'warning' | 'success' | 'error' | 'action';
  category: 'general' | 'support' | 'subscription' | 'campaign' | 'system' | 'promotion';
  title: string;
  body: string;
  action_url: string | null;
  meta: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// Support
export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  organization_id: string;
  subject: string;
  description: string;
  category: 'billing' | 'technical' | 'account' | 'whatsapp' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
  assigned_to: string | null;
  assigned_at?: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_feedback: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count?: number;
  message_count?: number;
  can_rate?: boolean;
  user?: SupportActorSummary | null;
  assigned_admin?: SupportActorSummary | null;
  organization?: SupportOrganizationSummary | null;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  reply_type: 'user' | 'admin' | 'system';
  message_kind?: 'root' | 'reply';
  body: string;
  attachments: string[] | null;
  sender?: SupportActorSummary | null;
  created_at: string;
}

export interface SupportActorSummary {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
  full_name: string | null;
}

export interface SupportOrganizationSummary {
  id: string;
  name: string | null;
  slug: string | null;
  status: string | null;
  logo_url: string | null;
}

export interface SupportThreadBootstrap {
  ticket: SupportTicket;
  messages: TicketReply[];
  messages_meta: PaginationMeta;
}

// Media
export interface MediaFile {
  id: string;
  user_id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  path: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  meta: Record<string, unknown> | null;
  whatsapp_media_id: string | null;
  created_at: string;
  updated_at: string;
}
