import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useOrganizationContext } from './useOrganizationContext';
import { buildOrganizationNavigationTarget } from './context';

export function OrganizationScopeGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { organizations, activeOrganization, isLoading } = useOrganizationContext(slug || null);

  useEffect(() => {
    if (isLoading || !organizations.length) {
      return;
    }

    const matchedOrganization = organizations.find((organization) => organization.slug === slug);
    const fallbackOrganization = activeOrganization || organizations[0];

    if (!matchedOrganization && fallbackOrganization) {
      navigate(
        buildOrganizationNavigationTarget(
          fallbackOrganization.slug,
          location.pathname,
          location.search,
          location.hash
        ),
        { replace: true }
      );
    }
  }, [activeOrganization, isLoading, location.hash, location.pathname, location.search, navigate, organizations, slug]);

  if (isLoading || !activeOrganization) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}

