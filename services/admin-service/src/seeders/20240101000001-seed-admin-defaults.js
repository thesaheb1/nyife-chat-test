'use strict';

const { v4: uuidv4 } = require('uuid');

const SUPER_ADMIN_ROLE_TITLE = 'Super Admin';
const SUPER_ADMIN_PERMISSIONS = {
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
};

const DEFAULT_SETTINGS = [
  {
    key: 'general',
    group: 'general',
    value: {
      site_name: 'Nyife',
      site_url: 'http://localhost:5173',
      logo_url: '',
      favicon_url: '',
      company_name: 'Nyife Technologies',
      company_address: '',
      company_email: 'admin@nyife.com',
      company_phone: '',
    },
  },
  {
    key: 'seo',
    group: 'seo',
    value: {
      meta_title: 'Nyife - WhatsApp Marketing Platform',
      meta_description: 'Multi-tenant WhatsApp Marketing SaaS platform for businesses',
      meta_keywords: 'whatsapp,marketing,saas,business,messaging',
      og_image: '',
    },
  },
  {
    key: 'timezone',
    group: 'timezone',
    value: {
      default_timezone: 'Asia/Kolkata',
      default_currency: 'INR',
    },
  },
  {
    key: 'sso',
    group: 'sso',
    value: {
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
    },
  },
  {
    key: 'payment',
    group: 'payment',
    value: {
      razorpay: {
        enabled: false,
        key_id: '',
        key_secret: '',
        webhook_secret: '',
      },
    },
  },
  {
    key: 'tax',
    group: 'tax',
    value: {
      enabled: false,
      type: 'GST',
      rate: 18,
      inclusive: false,
    },
  },
  {
    key: 'smtp',
    group: 'smtp',
    value: {
      host: '',
      port: 587,
      user: '',
      pass: '',
      from_email: '',
      from_name: 'Nyife',
    },
  },
  {
    key: 'frontend',
    group: 'frontend',
    value: {
      privacy_policy_html: '',
      terms_conditions_html: '',
      refund_policy_html: '',
    },
  },
  {
    key: 'billing',
    group: 'billing',
    value: {
      company_name: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
    },
  },
  {
    key: 'languages',
    group: 'languages',
    value: {
      default: 'en',
      available: ['en', 'hi'],
    },
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const existingRole = await queryInterface.sequelize.query(
      `SELECT id
       FROM admin_roles
       WHERE title = :title AND is_system = :isSystem
       LIMIT 1`,
      {
        replacements: {
          title: SUPER_ADMIN_ROLE_TITLE,
          isSystem: true,
        },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    if (!existingRole.length) {
      await queryInterface.bulkInsert('admin_roles', [
        {
          id: uuidv4(),
          title: SUPER_ADMIN_ROLE_TITLE,
          permissions: JSON.stringify(SUPER_ADMIN_PERMISSIONS),
          is_system: true,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    const existingSettingsRows = await queryInterface.sequelize.query(
      'SELECT `key` FROM admin_settings',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const existingSettingKeys = new Set(existingSettingsRows.map((row) => row.key));
    const settingsToInsert = DEFAULT_SETTINGS
      .filter((setting) => !existingSettingKeys.has(setting.key))
      .map((setting) => ({
        id: uuidv4(),
        key: setting.key,
        group: setting.group,
        value: JSON.stringify(setting.value),
        updated_by: null,
        created_at: now,
        updated_at: now,
      }));

    if (settingsToInsert.length) {
      await queryInterface.bulkInsert('admin_settings', settingsToInsert);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'admin_settings',
      { key: DEFAULT_SETTINGS.map((setting) => setting.key) },
      {}
    );
    await queryInterface.bulkDelete(
      'admin_roles',
      { title: SUPER_ADMIN_ROLE_TITLE, is_system: true },
      {}
    );
  },
};
