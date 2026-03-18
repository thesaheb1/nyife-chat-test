import type { Permissions } from '@/core/types';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type ResourceDefinition = {
  key: string;
  label: string;
  assignable?: boolean;
};

export const CRUD_ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete'];

export const ORGANIZATION_RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'templates', label: 'Templates' },
  { key: 'flows', label: 'Flows' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'automations', label: 'Automations' },
  { key: 'chat', label: 'Chat' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'support', label: 'Support' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
  { key: 'billing', label: 'Billing' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'organizations', label: 'Organizations', assignable: false },
  { key: 'team_members', label: 'Team Members', assignable: false },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'developer', label: 'Developer' },
];

export const ADMIN_RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'plans', label: 'Plans' },
  { key: 'support', label: 'Support' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'emails', label: 'Emails' },
  { key: 'settings', label: 'Settings' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'sub_admins', label: 'Sub Admins', assignable: false },
  { key: 'roles', label: 'Roles', assignable: false },
];

export const ORGANIZATION_RESOURCE_KEYS = ORGANIZATION_RESOURCE_DEFINITIONS.map((resource) => resource.key);
export const ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS = ORGANIZATION_RESOURCE_DEFINITIONS.filter(
  (resource) => resource.assignable !== false
);
export const ORGANIZATION_ASSIGNABLE_RESOURCE_KEYS = ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS.map(
  (resource) => resource.key
);
export const ADMIN_RESOURCE_KEYS = ADMIN_RESOURCE_DEFINITIONS.map((resource) => resource.key);
export const ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS = ADMIN_RESOURCE_DEFINITIONS.filter(
  (resource) => resource.assignable !== false
);
export const ADMIN_ASSIGNABLE_RESOURCE_KEYS = ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS.map(
  (resource) => resource.key
);

function createResourcePermission(defaultValue = false) {
  return CRUD_ACTIONS.reduce(
    (accumulator, action) => {
      accumulator[action] = defaultValue;
      return accumulator;
    },
    {} as Permissions['resources'][string]
  );
}

export function buildPermissionMap(resourceKeys: string[], defaultValue = false): Permissions {
  return {
    resources: resourceKeys.reduce(
      (accumulator, resource) => {
        accumulator[resource] = createResourcePermission(defaultValue);
        return accumulator;
      },
      {} as Permissions['resources']
    ),
  };
}

export function normalizePermissionMap(
  permissions: Permissions | null | undefined,
  definitions: ResourceDefinition[]
): Permissions {
  const resourceKeys = definitions.map((definition) => definition.key);
  const normalized = buildPermissionMap(resourceKeys, false);

  for (const resource of resourceKeys) {
    const current = permissions?.resources?.[resource];
    if (!current) {
      continue;
    }

    normalized.resources[resource] = {
      create: Boolean(current.create),
      read: Boolean(current.read),
      update: Boolean(current.update),
      delete: Boolean(current.delete),
    };
  }

  return normalized;
}

export function hasPermission(
  permissions: Permissions | null | undefined,
  resource: string,
  action: PermissionAction
) {
  return Boolean(permissions?.resources?.[resource]?.[action]);
}
