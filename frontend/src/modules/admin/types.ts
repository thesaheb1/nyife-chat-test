import type { User, Plan, Subscription, Transaction, Invoice, SupportTicket, TicketReply, Permissions } from '@/core/types';

// Re-export commonly used types
export type { User, Plan, Subscription, Transaction, Invoice, SupportTicket, TicketReply, Permissions };

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

// Extended user detail from admin
export interface AdminUserDetail extends User {
  wallet_balance: number;
  current_plan: string | null;
  subscription_status: string | null;
  organizations_count: number;
}
