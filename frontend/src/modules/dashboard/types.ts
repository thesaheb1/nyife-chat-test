export interface DashboardData {
  contacts: { total: number };
  groups: { total: number };
  templates: {
    total: number;
    by_status: Record<string, number>;
  };
  campaigns: {
    total: number;
    by_status: Record<string, number>;
  };
  messages: {
    today: MessageStats;
    this_week: MessageStats;
    this_month: MessageStats;
  };
  wallet: {
    balance: number;
    recent_transactions: RecentTransaction[];
  };
  subscription: DashboardSubscription | null;
  team_members: { total: number };
  organizations: { total: number };
  whatsapp_accounts: { total: number };
  timeline: TimelineEntry[];
}

export interface MessageStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface RecentTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
}

export interface DashboardSubscription {
  id: string;
  plan_id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  usage: {
    contacts_used: number;
    templates_used: number;
    campaigns_this_month: number;
    messages_this_month: number;
    team_members_used: number;
    organizations_used: number;
    whatsapp_numbers_used: number;
  };
  plan_name: string;
  plan_type: string;
}

export interface TimelineEntry {
  date: string;
  metric: string;
  value: number;
}
