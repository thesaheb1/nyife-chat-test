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
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
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

// Templates
export interface Template {
  id: string;
  user_id: string;
  waba_id: string | null;
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
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
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
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | null;
  messaging_limit: string | null;
  status: 'active' | 'inactive' | 'restricted' | 'banned';
  created_at: string;
  updated_at: string;
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
  amount_paid: number;
  discount_amount: number;
  tax_amount: number;
  auto_renew: boolean;
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
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  status: 'active' | 'inactive';
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
}

export interface Permissions {
  resources: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>;
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
  subject: string;
  description: string;
  category: 'billing' | 'technical' | 'account' | 'whatsapp' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  reply_type: 'user' | 'admin' | 'system';
  body: string;
  attachments: string[] | null;
  created_at: string;
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
