'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // 1. Seed the system super_admin role with full permissions
    const superAdminRoleId = uuidv4();
    await queryInterface.bulkInsert('admin_roles', [
      {
        id: superAdminRoleId,
        title: 'Super Admin',
        permissions: JSON.stringify({
          resources: {
            users: { create: true, read: true, update: true, delete: true },
            dashboard: { create: true, read: true, update: true, delete: true },
            support: { create: true, read: true, update: true, delete: true },
            plans: { create: true, read: true, update: true, delete: true },
            notifications: { create: true, read: true, update: true, delete: true },
            emails: { create: true, read: true, update: true, delete: true },
            settings: { create: true, read: true, update: true, delete: true },
            sub_admins: { create: true, read: true, update: true, delete: true },
            analytics: { create: true, read: true, update: true, delete: true },
          },
        }),
        is_system: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    // 2. Seed default admin settings (one row per group)
    const settings = [
      {
        id: uuidv4(),
        key: 'general',
        group: 'general',
        value: JSON.stringify({
          site_name: 'Nyife',
          site_url: 'http://localhost:5173',
          logo_url: '',
          favicon_url: '',
          company_name: 'Nyife Technologies',
          company_address: '',
          company_email: 'admin@nyife.com',
          company_phone: '',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'seo',
        group: 'seo',
        value: JSON.stringify({
          meta_title: 'Nyife - WhatsApp Marketing Platform',
          meta_description: 'Multi-tenant WhatsApp Marketing SaaS platform for businesses',
          meta_keywords: 'whatsapp,marketing,saas,business,messaging',
          og_image: '',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'timezone',
        group: 'timezone',
        value: JSON.stringify({
          default_timezone: 'Asia/Kolkata',
          default_currency: 'INR',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'sso',
        group: 'sso',
        value: JSON.stringify({
          google: {
            enabled: false,
            client_id: '',
            client_secret: '',
          },
          facebook: {
            enabled: false,
            app_id: '',
            app_secret: '',
          },
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'payment',
        group: 'payment',
        value: JSON.stringify({
          razorpay: {
            enabled: false,
            key_id: '',
            key_secret: '',
            webhook_secret: '',
          },
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'tax',
        group: 'tax',
        value: JSON.stringify({
          enabled: false,
          type: 'GST',
          rate: 18,
          inclusive: false,
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'smtp',
        group: 'smtp',
        value: JSON.stringify({
          host: '',
          port: 587,
          user: '',
          pass: '',
          from_email: '',
          from_name: 'Nyife',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'frontend',
        group: 'frontend',
        value: JSON.stringify({
          privacy_policy_html: '',
          terms_conditions_html: '',
          refund_policy_html: '',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'billing',
        group: 'billing',
        value: JSON.stringify({
          company_name: '',
          gstin: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        key: 'languages',
        group: 'languages',
        value: JSON.stringify({
          default: 'en',
          available: ['en', 'hi'],
        }),
        updated_by: null,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('admin_settings', settings);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('admin_settings', null, {});
    await queryInterface.bulkDelete('admin_roles', { is_system: true }, {});
  },
};
