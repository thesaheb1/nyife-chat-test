export const ADMIN_ENDPOINTS = {
  AUTHORIZATION: '/api/v1/admin/me/authorization',
  INVITATIONS: {
    BASE: '/api/v1/admin/sub-admins/invitations',
    DETAIL: (id: string) => `/api/v1/admin/sub-admins/invitations/${id}`,
    RESEND: (id: string) => `/api/v1/admin/sub-admins/invitations/${id}/resend`,
    VALIDATE: '/api/v1/admin/invitations/validate',
    ACCEPT: '/api/v1/admin/invitations/accept',
  },
  DASHBOARD: '/api/v1/admin/analytics/dashboard',
  METRICS: '/api/v1/admin/analytics/metrics',

  USERS: {
    BASE: '/api/v1/admin/users',
    DETAIL: (id: string) => `/api/v1/admin/users/${id}`,
    DASHBOARD: (id: string) => `/api/v1/admin/users/${id}/dashboard`,
    STATUS: (id: string) => `/api/v1/admin/users/${id}/status`,
    TEAM_MEMBERS: (id: string) => `/api/v1/admin/users/${id}/team-members`,
    AVATAR: (id: string) => `/api/v1/admin/users/${id}/avatar`,
    WALLET_CREDIT: (id: string) => `/api/v1/admin/users/${id}/wallet/credit`,
    WALLET_DEBIT: (id: string) => `/api/v1/admin/users/${id}/wallet/debit`,
    TRANSACTIONS: (id: string) => `/api/v1/admin/users/${id}/transactions`,
    SUBSCRIPTIONS: (id: string) => `/api/v1/admin/users/${id}/subscriptions`,
    INVOICES: (id: string) => `/api/v1/admin/users/${id}/invoices`,
    INVITATIONS: {
      BASE: '/api/v1/admin/users/invitations',
      DETAIL: (id: string) => `/api/v1/admin/users/invitations/${id}`,
      RESEND: (id: string) => `/api/v1/admin/users/invitations/${id}/resend`,
      VALIDATE: '/api/v1/admin/users/invitations/validate',
      ACCEPT: '/api/v1/admin/users/invitations/accept',
    },
  },

  PLANS: {
    BASE: '/api/v1/admin/plans',
    DETAIL: (id: string) => `/api/v1/admin/plans/${id}`,
    STATUS: (id: string) => `/api/v1/admin/plans/${id}/status`,
  },

  COUPONS: {
    BASE: '/api/v1/admin/coupons',
    DETAIL: (id: string) => `/api/v1/admin/coupons/${id}`,
  },

  SUB_ADMINS: {
    BASE: '/api/v1/admin/sub-admins',
    DETAIL: (id: string) => `/api/v1/admin/sub-admins/${id}`,
  },

  ROLES: {
    BASE: '/api/v1/admin/roles',
    DETAIL: (id: string) => `/api/v1/admin/roles/${id}`,
  },

  NOTIFICATIONS: {
    BASE: '/api/v1/admin/notifications',
  },

  SETTINGS: {
    BASE: '/api/v1/admin/settings',
    GROUP: (group: string) => `/api/v1/admin/settings/${group}`,
  },

  SUPPORT: {
    TICKETS: '/api/v1/admin/support/tickets',
    TICKET_DETAIL: (id: string) => `/api/v1/admin/support/tickets/${id}`,
    TICKET_REPLY: (id: string) => `/api/v1/admin/support/tickets/${id}/reply`,
    TICKET_ASSIGN: (id: string) => `/api/v1/admin/support/tickets/${id}/assign`,
    TICKET_STATUS: (id: string) => `/api/v1/admin/support/tickets/${id}/status`,
    USER_TICKETS: (userId: string) => `/api/v1/admin/support/tickets/user/${userId}`,
  },
} as const;
