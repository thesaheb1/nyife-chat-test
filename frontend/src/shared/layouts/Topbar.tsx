import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Moon, Sun, Monitor, LogOut, User, Settings, CreditCard, Building2, Check } from 'lucide-react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RootState, AppDispatch } from '@/core/store';
import { setTheme } from '@/core/store/uiSlice';
import { useAuth } from '@/core/hooks/useAuth';
import { formatCurrency } from '@/shared/utils/formatters';
import { buildOrganizationNavigationTarget, buildOrganizationPath, setStoredActiveOrganization } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import type { Organization } from '@/core/types';
import { usePermissions } from '@/core/hooks/usePermissions';

const ORG_SCOPED_QUERY_ROOTS = new Set([
  'dashboard',
  'unreadChatsCount',
  'contacts',
  'tags',
  'groups',
  'templates',
  'flows',
  'campaigns',
  'campaign-analytics',
  'campaign-messages',
  'conversations',
  'messages',
  'team-members',
  'team-invitations',
  'automations',
  'webhooks',
  'tickets',
  'wa-accounts',
  'wallet',
  'transactions',
  'invoices',
  'settings',
  'subscription',
  'subscriptions',
]);

function isOrganizationScopedQuery(query: Query) {
  const [root] = query.queryKey;
  return typeof root === 'string' && ORG_SCOPED_QUERY_ROOTS.has(root);
}

export function Topbar() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { organizations, activeOrganization } = useOrganizationContext(null, !isAdmin);
  const { canOrganization } = usePermissions();
  const previousOrganizationIdRef = useRef<string | null>(null);

  const initials = user
    ? `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigateToScopedPath = (path: string) => {
    if (!activeOrganization || isAdmin) {
      navigate(path);
      return;
    }

    navigate(buildOrganizationPath(activeOrganization.slug, path));
  };

  const handleOrganizationSwitch = (organization: Organization) => {
    setStoredActiveOrganization(organization);

    if (location.pathname.startsWith('/organizations')) {
      return;
    }

    navigate(
      buildOrganizationNavigationTarget(
        organization.slug,
        location.pathname,
        location.search,
        location.hash
      )
    );
  };

  useEffect(() => {
    if (isAdmin) {
      return;
    }

    const currentOrganizationId = activeOrganization?.id || null;
    const previousOrganizationId = previousOrganizationIdRef.current;

    if (!currentOrganizationId) {
      previousOrganizationIdRef.current = null;
      return;
    }

    if (previousOrganizationId && previousOrganizationId !== currentOrganizationId) {
      void queryClient.cancelQueries({ predicate: isOrganizationScopedQuery });
      queryClient.removeQueries({
        predicate: (query) => isOrganizationScopedQuery(query) && query.getObserversCount() === 0,
      });
      void queryClient.resetQueries({ predicate: isOrganizationScopedQuery });
    }

    previousOrganizationIdRef.current = currentOrganizationId;
  }, [activeOrganization?.id, isAdmin, queryClient]);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left: Breadcrumbs placeholder */}
      <div className="flex items-center gap-2">
        {!isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-w-[220px] justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{activeOrganization?.name || 'Organization'}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  className="flex items-center justify-between"
                  onClick={() => handleOrganizationSwitch(organization)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{organization.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{organization.slug}</p>
                  </div>
                  {activeOrganization?.id === organization.id ? <Check className="h-4 w-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Breadcrumbs />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Wallet Balance */}
        {canOrganization('wallet', 'read') ? (
          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => navigateToScopedPath('/wallet')}>
            <span className="text-xs">{formatCurrency(0)}</span>
          </Button>
        ) : null}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]" variant="destructive">
            0
          </Badge>
        </Button>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : theme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => dispatch(setTheme('light'))}>
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch(setTheme('dark'))}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch(setTheme('system'))}>
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.first_name} {user?.last_name}
                </span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canOrganization('settings', 'read') ? (
              <DropdownMenuItem onClick={() => navigateToScopedPath('/settings')}>
                <User className="mr-2 h-4 w-4" />
                {t('settings.profile')}
              </DropdownMenuItem>
            ) : null}
            {canOrganization('subscription', 'read') ? (
              <DropdownMenuItem onClick={() => navigateToScopedPath('/subscription')}>
                <CreditCard className="mr-2 h-4 w-4" />
                {t('nav.subscription')}
              </DropdownMenuItem>
            ) : null}
            {canOrganization('settings', 'read') ? (
              <DropdownMenuItem onClick={() => navigateToScopedPath('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                {t('nav.settings')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t('auth.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .filter((_, index, values) => !(values[0] === 'org' && (index === 0 || index === 1)));

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {segments.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          <span className={i === segments.length - 1 ? 'font-medium text-foreground' : ''}>
            {segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </nav>
  );
}
