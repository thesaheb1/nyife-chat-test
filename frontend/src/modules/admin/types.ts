import type {
  User,
  Plan,
  SupportTicket,
  TicketReply,
  Permissions,
} from '@/core/types';

// Re-export commonly used types
export type { User, Plan, SupportTicket, TicketReply, Permissions };

// Admin Dashboard
export interface AdminDashboardData {
  revenue: {
    today: number;
    this_week: number;
    this_month: number;
    this_year: number;
    total: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    new_today: number;
    new_this_week: number;
    new_this_month: number;
    by_status: Record<string, number>;
  };
  subscriptions: {
    active: number;
    expiring_soon: number;
    by_plan: Record<string, number>;
  };
  messages: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  templates: {
    total: number;
    by_status: Record<string, number>;
  };
  campaigns: {
    total: number;
    by_status: Record<string, number>;
  };
  support: {
    open_tickets: number;
    avg_resolution_hours: string;
    avg_satisfaction: string;
  };
  finances: {
    total_wallet_balance: number;
    total_transactions: number;
  };
  whatsapp_accounts: {
    total: number;
  };
  charts: {
    revenue_timeline: Array<{ date: string; value: number }>;
    user_growth: Array<{ date: string; value: number }>;
    message_volume: Array<{ date: string; metric: string; value: number }>;
    wallet_flow: Array<{ date: string; metric: string; value: number }>;
  };
}

// Admin Role
export interface AdminRole {
  id: string;
  title: string;
  permissions: Permissions;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// Sub-Admin
export interface SubAdmin {
  id: string;
  user_id: string;
  role_id: string;
  status: 'active' | 'inactive';
  created_by: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role?: AdminRole;
  user?: User;
}

export interface SubAdminInvitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  role_title: string;
  invited_by_user_id: string;
  accepted_user_id: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  role?: AdminRole | null;
}

// Coupon
export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  min_plan_price: number | null;
  applicable_plan_ids: string[] | null;
  applicable_user_ids: string[] | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Admin Setting
export interface AdminSetting {
  key: string;
  value: string;
  group: string;
}

// Broadcast Notification
export interface BroadcastNotification {
  id: string;
  title: string;
  body: string;
  target_type: 'all' | 'specific_users';
  target_user_ids: string[] | null;
  send_email: boolean;
  sent_count: number;
  created_at: string;
}

export interface AdminUserListItem extends User {
  wallet_balance: number;
  current_plan: string | null;
  subscription_status: string | null;
  organizations_count: number;
  primary_organization?: AdminUserOrganization | null;
}

export interface AdminUserOrganization {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  status: 'active' | 'inactive';
  wallet_balance: number;
  current_plan: string | null;
  subscription_status: string | null;
  team_members_count: number;
  support_tickets_count?: number;
  analytics_scope_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUserInvitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  invited_by_user_id: string;
  accepted_user_id: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDashboard {
  user: AdminUserListItem;
  organizations: AdminUserOrganization[];
  selected_organization: AdminUserOrganization | null;
  invitation: Record<string, unknown> | null;
  sections: {
    support: boolean;
    analytics: boolean;
  };
}

export interface AdminUserTeamMember {
  id: string;
  member_user_id: string;
  role_title: string;
  status: 'active' | 'inactive' | 'invited';
  invited_at: string | null;
  joined_at: string | null;
  permissions: Permissions;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

export interface AdminUserTeamMembersResult {
  organization: AdminUserOrganization | null;
  team_members: AdminUserTeamMember[];
}

export interface AdminUserTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface AdminUserSubscriptionRecord {
  id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  plan_name: string | null;
  plan_type: Plan['type'] | null;
  plan_price: number | null;
}

export interface AdminUserInvoiceRecord {
  id: string;
  invoice_number: string;
  type: 'subscription' | 'recharge' | 'message_charges';
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'paid' | 'pending' | 'cancelled';
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface AdminMetricsSeriesPoint {
  date: string;
  value: number;
}

export interface AdminMetricsResult {
  data: Record<string, AdminMetricsSeriesPoint[]>;
  summary: Record<string, number>;
}

export interface AdminUserSupportTicketsResult {
  tickets: SupportTicket[];
}

export interface AdminUserDetail extends AdminUserListItem {}
