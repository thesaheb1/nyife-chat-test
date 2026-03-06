export const ENDPOINTS = {
  AUTH: {
    REGISTER: '/api/v1/auth/register',
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    ME: '/api/v1/auth/me',
    VERIFY_EMAIL: '/api/v1/auth/verify-email',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    GOOGLE: '/api/v1/auth/google',
    FACEBOOK: '/api/v1/auth/facebook',
  },
  USERS: {
    PROFILE: '/api/v1/users/profile',
    PASSWORD: '/api/v1/users/password',
    SETTINGS: '/api/v1/users/settings',
    API_TOKENS: '/api/v1/users/api-tokens',
  },
  CONTACTS: {
    BASE: '/api/v1/contacts',
    TAGS: '/api/v1/contacts/tags',
    GROUPS: '/api/v1/contacts/groups',
    BULK_DELETE: '/api/v1/contacts/bulk-delete',
    IMPORT_CSV: '/api/v1/contacts/import/csv',
  },
  TEMPLATES: {
    BASE: '/api/v1/templates',
    SYNC: '/api/v1/templates/sync',
  },
  CAMPAIGNS: {
    BASE: '/api/v1/campaigns',
  },
  CHAT: {
    CONVERSATIONS: '/api/v1/chat/conversations',
  },
  WHATSAPP: {
    ACCOUNTS: '/api/v1/whatsapp/accounts',
    SEND: '/api/v1/whatsapp/send',
    SEND_TEMPLATE: '/api/v1/whatsapp/send/template',
    MESSAGES: '/api/v1/whatsapp/messages',
  },
  AUTOMATIONS: {
    BASE: '/api/v1/automations',
    WEBHOOKS: '/api/v1/automations/webhooks',
  },
  ORGANIZATIONS: {
    BASE: '/api/v1/organizations',
  },
  SUBSCRIPTIONS: {
    PLANS: '/api/v1/subscriptions/plans',
    SUBSCRIBE: '/api/v1/subscriptions/subscribe',
    VERIFY_PAYMENT: '/api/v1/subscriptions/verify-payment',
    CURRENT: '/api/v1/subscriptions/current',
    CANCEL: '/api/v1/subscriptions/cancel',
    VALIDATE_COUPON: '/api/v1/subscriptions/coupons/validate',
    HISTORY: '/api/v1/subscriptions/history',
  },
  WALLET: {
    BASE: '/api/v1/wallet',
    RECHARGE: '/api/v1/wallet/recharge',
    VERIFY_RECHARGE: '/api/v1/wallet/recharge/verify',
    TRANSACTIONS: '/api/v1/wallet/transactions',
    INVOICES: '/api/v1/wallet/invoices',
  },
  NOTIFICATIONS: {
    BASE: '/api/v1/notifications',
    UNREAD_COUNT: '/api/v1/notifications/unread-count',
    READ_ALL: '/api/v1/notifications/read-all',
  },
  SUPPORT: {
    TICKETS: '/api/v1/support/tickets',
  },
  ANALYTICS: {
    DASHBOARD: '/api/v1/analytics/dashboard',
    METRICS: '/api/v1/analytics/metrics',
  },
  MEDIA: {
    UPLOAD: '/api/v1/media/upload',
    BASE: '/api/v1/media',
  },
  SETTINGS: {
    PUBLIC: '/api/v1/settings/public',
  },
  ADMIN: {
    DASHBOARD: '/api/v1/admin/analytics/dashboard',
    METRICS: '/api/v1/admin/analytics/metrics',
    USERS: '/api/v1/admin/users',
    PLANS: '/api/v1/admin/plans',
    COUPONS: '/api/v1/admin/coupons',
    SUB_ADMINS: '/api/v1/admin/sub-admins',
    ROLES: '/api/v1/admin/roles',
    NOTIFICATIONS: '/api/v1/admin/notifications',
    SETTINGS: '/api/v1/admin/settings',
    SUPPORT_TICKETS: '/api/v1/admin/support/tickets',
  },
} as const;
