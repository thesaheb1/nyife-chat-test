import {
  CRUD_ACTIONS as TEAM_ACTIONS,
  ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS,
  ORGANIZATION_ASSIGNABLE_RESOURCE_KEYS as TEAM_RESOURCES,
  buildPermissionMap,
  normalizePermissionMap,
} from '@/core/permissions/catalog';
import type { Permissions } from '@/core/types';

export { TEAM_ACTIONS, TEAM_RESOURCES };

export function createEmptyPermissions(): Permissions {
  return buildPermissionMap(TEAM_RESOURCES, false);
}

export function normalizePermissions(permissions?: Permissions | null): Permissions {
  return normalizePermissionMap(permissions, ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS);
}
