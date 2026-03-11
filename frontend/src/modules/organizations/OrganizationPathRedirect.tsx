import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { buildOrganizationPath, buildOrganizationNavigationTarget } from './context';
import { useOrganizationContext } from './useOrganizationContext';

interface OrganizationPathRedirectProps {
  targetPath?: string;
}

export function OrganizationPathRedirect({ targetPath }: OrganizationPathRedirectProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { activeOrganization, isLoading } = useOrganizationContext(null, !isAdmin);

  useEffect(() => {
    if (isAdmin || !activeOrganization) {
      return;
    }

    const resolvedTarget = targetPath
      ? buildOrganizationPath(activeOrganization.slug, targetPath, location.search, location.hash)
      : buildOrganizationNavigationTarget(activeOrganization.slug, location.pathname, location.search, location.hash);

    navigate(resolvedTarget, { replace: true });
  }, [activeOrganization, isAdmin, location.hash, location.pathname, location.search, navigate, targetPath]);

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (isLoading || !activeOrganization) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return null;
}

