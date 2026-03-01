'use strict';

/**
 * Application-wide constants for the Nyife platform.
 * All microservices import constants from this single source of truth.
 */

const USER_ROLES = Object.freeze({
  OWNER: 'owner',
  TEAM_MEMBER: 'team_member',
});

const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  SUB_ADMIN: 'sub_admin',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
});

const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  STICKER: 'sticker',
  LOCATION: 'location',
  CONTACT: 'contact',
  REACTION: 'reaction',
  INTERACTIVE: 'interactive',
  TEMPLATE: 'template',
  BUTTON_REPLY: 'button_reply',
  LIST_REPLY: 'list_reply',
  ORDER: 'order',
});

const TEMPLATE_TYPES = Object.freeze({
  STANDARD: 'standard',
  AUTHENTICATION: 'authentication',
  CAROUSEL: 'carousel',
  FLOW: 'flow',
  LIST_MENU: 'list_menu',
  CATALOG: 'catalog',
  MPM: 'mpm',
});

const TEMPLATE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
});

const TEMPLATE_CATEGORIES = Object.freeze({
  MARKETING: 'MARKETING',
  UTILITY: 'UTILITY',
  AUTHENTICATION: 'AUTHENTICATION',
});

const PLAN_TYPES = Object.freeze({
  FREE: 'free',
  BASIC: 'basic',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
});

const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  TRIAL: 'trial',
});

const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const MESSAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
});

const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

const TRANSACTION_TYPES = Object.freeze({
  CREDIT: 'credit',
  DEBIT: 'debit',
});

const NOTIFICATION_TYPES = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
});

const CHAT_ASSIGNMENT_STATUS = Object.freeze({
  UNASSIGNED: 'unassigned',
  ASSIGNED: 'assigned',
  RESOLVED: 'resolved',
});

const WEBHOOK_EVENTS = Object.freeze({
  MESSAGE: 'message',
  STATUS: 'status',
  TEMPLATE_STATUS: 'template_status',
  PHONE_QUALITY: 'phone_quality',
  ACCOUNT_UPDATE: 'account_update',
});

module.exports = {
  USER_ROLES,
  ADMIN_ROLES,
  USER_STATUS,
  MESSAGE_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORIES,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
  CAMPAIGN_STATUS,
  MESSAGE_STATUS,
  TICKET_STATUS,
  TRANSACTION_TYPES,
  NOTIFICATION_TYPES,
  CHAT_ASSIGNMENT_STATUS,
  WEBHOOK_EVENTS,
};
