'use strict';

const AppError = require('./AppError');

const CRUD_ACTIONS = Object.freeze(['create', 'read', 'update', 'delete']);

const ORGANIZATION_RESOURCE_DEFINITIONS = Object.freeze([
  { key: 'dashboard', label: 'Dashboard', assignable: true },
  { key: 'contacts', label: 'Contacts', assignable: true },
  { key: 'templates', label: 'Templates', assignable: true },
  { key: 'flows', label: 'Flows', assignable: true },
  { key: 'campaigns', label: 'Campaigns', assignable: true },
  { key: 'automations', label: 'Automations', assignable: true },
  { key: 'chat', label: 'Chat', assignable: true },
  { key: 'wallet', label: 'Wallet', assignable: true },
  { key: 'support', label: 'Support', assignable: true },
  { key: 'analytics', label: 'Analytics', assignable: true },
  { key: 'settings', label: 'Settings', assignable: true },
  { key: 'billing', label: 'Billing', assignable: true },
  { key: 'subscription', label: 'Subscription', assignable: true },
  { key: 'organizations', label: 'Organizations', assignable: false },
  { key: 'team_members', label: 'Team Members', assignable: false },
  { key: 'whatsapp', label: 'WhatsApp', assignable: true },
  { key: 'developer', label: 'Developer', assignable: true },
]);

const ADMIN_RESOURCE_DEFINITIONS = Object.freeze([
  { key: 'dashboard', label: 'Dashboard', assignable: true },
  { key: 'users', label: 'Users', assignable: true },
  { key: 'plans', label: 'Plans', assignable: true },
  { key: 'support', label: 'Support', assignable: true },
  { key: 'notifications', label: 'Notifications', assignable: true },
  { key: 'emails', label: 'Emails', assignable: true },
  { key: 'settings', label: 'Settings', assignable: true },
  { key: 'analytics', label: 'Analytics', assignable: true },
  { key: 'sub_admins', label: 'Sub Admins', assignable: false },
  { key: 'roles', label: 'Roles', assignable: false },
]);

const ADMIN_PERMISSION_ALIASES = Object.freeze({
  email: 'emails',
});

function getResourceKeys(definitions, { assignableOnly = false } = {}) {
  return definitions
    .filter((definition) => !assignableOnly || definition.assignable !== false)
    .map((definition) => definition.key);
}

const ORGANIZATION_RESOURCE_KEYS = Object.freeze(getResourceKeys(ORGANIZATION_RESOURCE_DEFINITIONS));
const ORGANIZATION_ASSIGNABLE_RESOURCE_KEYS = Object.freeze(
  getResourceKeys(ORGANIZATION_RESOURCE_DEFINITIONS, { assignableOnly: true })
);
const ORGANIZATION_RESERVED_RESOURCE_KEYS = Object.freeze(
  ORGANIZATION_RESOURCE_DEFINITIONS.filter((definition) => definition.assignable === false).map(
    (definition) => definition.key
  )
);
const ADMIN_RESOURCE_KEYS = Object.freeze(getResourceKeys(ADMIN_RESOURCE_DEFINITIONS));
const ADMIN_ASSIGNABLE_RESOURCE_KEYS = Object.freeze(
  getResourceKeys(ADMIN_RESOURCE_DEFINITIONS, { assignableOnly: true })
);
const ADMIN_RESERVED_RESOURCE_KEYS = Object.freeze(
  ADMIN_RESOURCE_DEFINITIONS.filter((definition) => definition.assignable === false).map(
    (definition) => definition.key
  )
);

function createResourcePermission(defaultValue = false) {
  return CRUD_ACTIONS.reduce((accumulator, action) => {
    accumulator[action] = Boolean(defaultValue);
    return accumulator;
  }, {});
}

function buildPermissionMap(resourceKeys, defaultValue = false) {
  return {
    resources: resourceKeys.reduce((accumulator, resource) => {
      accumulator[resource] = createResourcePermission(defaultValue);
      return accumulator;
    }, {}),
  };
}

function normalizeResourceKey(resource, aliases = {}) {
  if (!resource) {
    return null;
  }

  const normalized = String(resource).trim();
  if (!normalized) {
    return null;
  }

  return aliases[normalized] || normalized;
}

function normalizePermissions(permissions, definitions, options = {}) {
  const {
    aliases = {},
    includeReserved = true,
    stripResources = [],
  } = options;

  const allowedKeys = getResourceKeys(definitions, { assignableOnly: !includeReserved });
  const allowedKeySet = new Set(allowedKeys);
  const strippedKeySet = new Set(stripResources);
  const normalized = buildPermissionMap(allowedKeys, false);
  const sourceResources =
    permissions && typeof permissions === 'object' && permissions.resources && typeof permissions.resources === 'object'
      ? permissions.resources
      : {};

  for (const [resource, rawActions] of Object.entries(sourceResources)) {
    const normalizedResource = normalizeResourceKey(resource, aliases);
    if (!normalizedResource || !allowedKeySet.has(normalizedResource) || strippedKeySet.has(normalizedResource)) {
      continue;
    }

    normalized.resources[normalizedResource] = CRUD_ACTIONS.reduce((accumulator, action) => {
      accumulator[action] = Boolean(rawActions && rawActions[action]);
      return accumulator;
    }, {});
  }

  return normalized;
}

function normalizeOrganizationPermissions(permissions, options = {}) {
  const { includeReserved = true } = options;

  return normalizePermissions(permissions, ORGANIZATION_RESOURCE_DEFINITIONS, {
    includeReserved,
    stripResources: includeReserved ? [] : ORGANIZATION_RESERVED_RESOURCE_KEYS,
  });
}

function normalizeAdminPermissions(permissions, options = {}) {
  const { includeReserved = false } = options;

  return normalizePermissions(permissions, ADMIN_RESOURCE_DEFINITIONS, {
    aliases: ADMIN_PERMISSION_ALIASES,
    includeReserved,
    stripResources: includeReserved ? [] : ADMIN_RESERVED_RESOURCE_KEYS,
  });
}

function buildFullPermissions(definitions, options = {}) {
  const { includeReserved = true } = options;
  return buildPermissionMap(getResourceKeys(definitions, { assignableOnly: !includeReserved }), true);
}

function buildFullOrganizationPermissions() {
  return buildFullPermissions(ORGANIZATION_RESOURCE_DEFINITIONS);
}

function buildFullAdminPermissions(options = {}) {
  return buildFullPermissions(ADMIN_RESOURCE_DEFINITIONS, options);
}

function isValidCrudAction(action) {
  return CRUD_ACTIONS.includes(action);
}

function hasPermission(permissions, resource, action) {
  if (!resource || !isValidCrudAction(action)) {
    return false;
  }

  return Boolean(permissions?.resources?.[resource]?.[action]);
}

function hasAnyPermission(permissions, requirements = []) {
  return requirements.some((requirement) =>
    hasPermission(permissions, requirement.resource, requirement.action)
  );
}

function assertPermission(permissions, resource, action, options = {}) {
  if (hasPermission(permissions, resource, action)) {
    return true;
  }

  throw AppError.forbidden(
    options.message || 'You do not have permission to perform this action.',
    options.code || 'INSUFFICIENT_PERMISSIONS'
  );
}

module.exports = {
  CRUD_ACTIONS,
  ORGANIZATION_RESOURCE_DEFINITIONS,
  ORGANIZATION_RESOURCE_KEYS,
  ORGANIZATION_ASSIGNABLE_RESOURCE_KEYS,
  ORGANIZATION_RESERVED_RESOURCE_KEYS,
  ADMIN_RESOURCE_DEFINITIONS,
  ADMIN_RESOURCE_KEYS,
  ADMIN_ASSIGNABLE_RESOURCE_KEYS,
  ADMIN_RESERVED_RESOURCE_KEYS,
  ADMIN_PERMISSION_ALIASES,
  createResourcePermission,
  buildPermissionMap,
  buildFullPermissions,
  buildFullOrganizationPermissions,
  buildFullAdminPermissions,
  normalizePermissions,
  normalizeOrganizationPermissions,
  normalizeAdminPermissions,
  hasPermission,
  hasAnyPermission,
  assertPermission,
  isValidCrudAction,
};
