import type { ReactNode } from 'react';
import { usePermissions } from '@/core/hooks/usePermissions';
import { UnauthorizedPage } from '@/shared/components/UnauthorizedPage';

type PermissionGuardProps = {
  scope: 'organization' | 'admin';
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGuard({
  scope,
  resource,
  action,
  children,
  fallback,
}: PermissionGuardProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!can(resource, action, scope)) {
    return <>{fallback ?? <UnauthorizedPage />}</>;
  }

  return <>{children}</>;
}
