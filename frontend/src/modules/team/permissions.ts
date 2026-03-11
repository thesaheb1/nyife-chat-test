import type { Permissions } from '@/core/types';

export const TEAM_RESOURCES = [
  'dashboard',
  'contacts',
  'templates',
  'flows',
  'campaigns',
  'automations',
  'chat',
  'wallet',
  'support',
  'analytics',
  'settings',
  'billing',
  'subscription',
  'organizations',
  'team_members',
  'whatsapp',
  'developer',
] as const;

export const TEAM_ACTIONS = ['create', 'read', 'update', 'delete'] as const;

export function createEmptyPermissions(): Permissions {
  return {
    resources: TEAM_RESOURCES.reduce((acc, resource) => {
      acc[resource] = {
        create: false,
        read: false,
        update: false,
        delete: false,
      };
      return acc;
    }, {} as Permissions['resources']),
  };
}

export function normalizePermissions(permissions?: Permissions | null): Permissions {
  const empty = createEmptyPermissions();
  if (!permissions?.resources) {
    return empty;
  }

  for (const resource of TEAM_RESOURCES) {
    const current = permissions.resources[resource];
    if (!current) {
      continue;
    }

    empty.resources[resource] = {
      create: Boolean(current.create),
      read: Boolean(current.read),
      update: Boolean(current.update),
      delete: Boolean(current.delete),
    };
  }

  return empty;
}
