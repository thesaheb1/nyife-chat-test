import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { hasPermission } from '@/core/permissions/catalog';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { useAdminAuthorization } from '@/modules/admin/useAdminAuthorization';

type PermissionAction = 'create' | 'read' | 'update' | 'delete';
type PermissionScope = 'organization' | 'admin' | 'auto';

export function usePermissions() {
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminAccount = user?.role === 'admin' || user?.role === 'super_admin';
  const organizationContext = useOrganizationContext(null, !isAdminAccount);
  const adminAuthorization = useAdminAuthorization(isAdminAccount);

  const isOwner = organizationContext.activeOrganization?.organization_role === 'owner';
  const isSuperAdmin = adminAuthorization.data?.is_super_admin === true || user?.role === 'super_admin';
  const isSubAdmin = Boolean(isAdminAccount && !isSuperAdmin);

  const canOrganization = (resource: string, action: PermissionAction) => {
    if (!user || isAdminAccount) {
      return false;
    }

    if (isOwner) {
      return true;
    }

    return hasPermission(organizationContext.activeOrganization?.permissions, resource, action);
  };

  const canAdmin = (resource: string, action: PermissionAction) => {
    if (!user || !isAdminAccount) {
      return false;
    }

    if (isSuperAdmin) {
      return true;
    }

    return hasPermission(adminAuthorization.data?.permissions, resource, action);
  };

  const can = (
    resource: string,
    action: PermissionAction,
    scope: PermissionScope = 'auto'
  ) => {
    const resolvedScope = scope === 'auto' ? (isAdminRoute ? 'admin' : 'organization') : scope;
    return resolvedScope === 'admin' ? canAdmin(resource, action) : canOrganization(resource, action);
  };

  const isLoading = isAdminRoute
    ? adminAuthorization.isLoading
    : organizationContext.isLoading;

  return {
    can,
    canAdmin,
    canOrganization,
    isOwner,
    isAdmin: isAdminAccount,
    isSuperAdmin,
    isSubAdmin,
    isLoading,
    user,
    activeOrganization: organizationContext.activeOrganization,
    adminAuthorization: adminAuthorization.data || null,
    adminAuthorizationError: adminAuthorization.error || null,
  };
}

export function useCan(scope: Exclude<PermissionScope, 'auto'>, resource: string, action: PermissionAction) {
  const permissions = usePermissions();
  return permissions.can(resource, action, scope);
}
