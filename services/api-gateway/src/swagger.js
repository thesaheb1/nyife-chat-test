'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nyife API',
      version: '1.0.0',
      description: 'WhatsApp Marketing SaaS Platform API Documentation',
      contact: {
        name: 'Nyife Team',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Users', description: 'User profile and settings' },
      { name: 'Subscriptions', description: 'Plans, subscriptions, and coupons' },
      { name: 'Wallet', description: 'Wallet balance, recharge, and transactions' },
      { name: 'Contacts', description: 'Contact management, groups, and tags' },
      { name: 'Templates', description: 'WhatsApp message templates' },
      { name: 'Campaigns', description: 'Campaign creation and execution' },
      { name: 'Chat', description: 'Real-time chat and messaging' },
      { name: 'WhatsApp', description: 'WhatsApp Business API integration' },
      { name: 'Automations', description: 'Automation rules and webhooks' },
      { name: 'Organizations', description: 'Organizations and team management' },
      { name: 'Notifications', description: 'In-app and push notifications' },
      { name: 'Support', description: 'Support tickets' },
      { name: 'Admin', description: 'Admin panel operations' },
      { name: 'Analytics', description: 'Dashboard analytics' },
      { name: 'Media', description: 'File uploads and media management' },
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'first_name', 'last_name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    first_name: { type: 'string' },
                    last_name: { type: 'string' },
                    phone: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'User registered successfully' },
            400: { description: 'Validation error' },
            409: { description: 'Email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Login successful, returns access token' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token using refresh token cookie',
          responses: {
            200: { description: 'New token pair returned' },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout and revoke refresh token',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Logged out successfully' } },
        },
      },
      '/auth/verify-email': {
        post: {
          tags: ['Auth'],
          summary: 'Verify email with token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] } } },
          },
          responses: { 200: { description: 'Email verified' }, 400: { description: 'Invalid token' } },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset email',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] } } },
          },
          responses: { 200: { description: 'Reset email sent (if account exists)' } },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, new_password: { type: 'string', minLength: 8 } }, required: ['token', 'new_password'] } } },
          },
          responses: { 200: { description: 'Password reset' }, 400: { description: 'Invalid token' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'User profile' }, 401: { description: 'Not authenticated' } },
        },
      },
      '/subscriptions/plans': {
        get: {
          tags: ['Subscriptions'],
          summary: 'List all active plans',
          responses: { 200: { description: 'Plans list' } },
        },
      },
      '/subscriptions/subscribe': {
        post: {
          tags: ['Subscriptions'],
          summary: 'Subscribe to a plan',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { plan_id: { type: 'string', format: 'uuid' }, coupon_code: { type: 'string' } }, required: ['plan_id'] } } },
          },
          responses: { 201: { description: 'Subscription created' }, 409: { description: 'Already subscribed' } },
        },
      },
      '/subscriptions/current': {
        get: {
          tags: ['Subscriptions'],
          summary: 'Get current active subscription',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Current subscription or null' } },
        },
      },
      '/wallet': {
        get: {
          tags: ['Wallet'],
          summary: 'Get wallet balance',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Wallet balance' } },
        },
      },
      '/wallet/recharge': {
        post: {
          tags: ['Wallet'],
          summary: 'Initiate wallet recharge',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: {
                      type: 'number',
                      minimum: 100,
                      example: 499.5,
                      description: 'Amount in rupees',
                    },
                  },
                  required: ['amount'],
                },
              },
            },
          },
          responses: { 201: { description: 'Razorpay order created' } },
        },
      },
      '/wallet/transactions': {
        get: {
          tags: ['Wallet'],
          summary: 'List wallet transactions',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['credit', 'debit'] } },
          ],
          responses: { 200: { description: 'Paginated transactions' } },
        },
      },
      '/campaigns': {
        get: {
          tags: ['Campaigns'],
          summary: 'List campaigns',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'running', 'paused', 'completed', 'cancelled'] } },
          ],
          responses: { 200: { description: 'Paginated campaigns' } },
        },
        post: {
          tags: ['Campaigns'],
          summary: 'Create a new campaign',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['name', 'wa_account_id', 'template_id', 'target_type', 'target_config'], properties: { name: { type: 'string' }, wa_account_id: { type: 'string', format: 'uuid' }, template_id: { type: 'string', format: 'uuid' }, target_type: { type: 'string', enum: ['contacts', 'group', 'tags', 'all'] }, target_config: { type: 'object' } } } } },
          },
          responses: { 201: { description: 'Campaign created' } },
        },
      },
      '/campaigns/{id}/start': {
        post: {
          tags: ['Campaigns'],
          summary: 'Start campaign execution',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Campaign started' }, 400: { description: 'Cannot start' } },
        },
      },
      '/automations': {
        get: {
          tags: ['Automations'],
          summary: 'List automations',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Paginated automations' } },
        },
        post: {
          tags: ['Automations'],
          summary: 'Create an automation',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['wa_account_id', 'name', 'type', 'trigger_config', 'action_config'], properties: { wa_account_id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, type: { type: 'string', enum: ['basic_reply', 'advanced_flow'] }, trigger_config: { type: 'object' }, action_config: { type: 'object' } } } } },
          },
          responses: { 201: { description: 'Automation created' } },
        },
      },
      '/contacts': {
        get: {
          tags: ['Contacts'],
          summary: 'List contacts',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Paginated contacts' } },
        },
      },
      '/templates': {
        get: {
          tags: ['Templates'],
          summary: 'List message templates',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Paginated templates' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Nyife API Docs',
  }));

  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = { setupSwagger };
