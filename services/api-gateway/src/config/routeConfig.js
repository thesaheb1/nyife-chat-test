'use strict';

/**
 * Route configuration map for the API Gateway.
 *
 * Each entry maps a public URL prefix to an internal microservice,
 * specifying whether JWT authentication is required and which rate
 * limit tier applies.
 *
 * Properties per route:
 *   prefix      - URL path prefix matched by the gateway
 *   service     - Key in config.services (resolves to internal URL)
 *   auth        - true  = JWT verification required before proxying
 *                 false = route is publicly accessible
 *   rateLimit   - 'global' (default 100 req/min) or 'auth' (stricter, 10 req/min)
 *   publicPaths - Array of sub-paths under this prefix that bypass auth
 *                 even when auth=true (e.g., webhook endpoints)
 *   ws          - true to enable WebSocket proxy (e.g., Socket.IO)
 */
const routeConfig = [
  {
    prefix: '/api/v1/auth',
    service: 'auth',
    auth: false,
    rateLimit: 'auth',
  },
  {
    prefix: '/api/v1/users',
    service: 'user',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/subscriptions',
    service: 'subscription',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/subscriptions/plans'],
  },
  {
    prefix: '/api/v1/wallet',
    service: 'wallet',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/contacts',
    service: 'contact',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/templates',
    service: 'template',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/flows',
    service: 'template',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/campaigns',
    service: 'campaign',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/chat',
    service: 'chat',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/chat/socket.io'],
  },
  {
    prefix: '/api/v1/whatsapp',
    service: 'whatsapp',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/whatsapp/webhook', '/api/v1/whatsapp/flows/data-exchange'],
  },
  {
    prefix: '/api/v1/automations',
    service: 'automation',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/organizations',
    service: 'organization',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/organizations/invitations/accept'],
  },
  {
    prefix: '/api/v1/notifications',
    service: 'notification',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/notifications/socket.io'],
  },
  {
    prefix: '/api/v1/emails',
    service: 'email',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/support',
    service: 'support',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/support/socket.io'],
  },
  {
    prefix: '/api/v1/admin/support',
    service: 'support',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/admin/analytics',
    service: 'analytics',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/admin',
    service: 'admin',
    auth: true,
    rateLimit: 'global',
    publicPaths: [
      '/api/v1/admin/invitations/validate',
      '/api/v1/admin/invitations/accept',
      '/api/v1/admin/users/invitations/validate',
      '/api/v1/admin/users/invitations/accept',
    ],
  },
  {
    prefix: '/api/v1/analytics',
    service: 'analytics',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/media',
    service: 'media',
    auth: true,
    rateLimit: 'global',
  },
  {
    prefix: '/api/v1/settings',
    service: 'admin',
    auth: true,
    rateLimit: 'global',
    publicPaths: ['/api/v1/settings/public'],
  },
];

module.exports = routeConfig;
