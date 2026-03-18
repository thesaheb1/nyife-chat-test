import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type Query } from '@tanstack/react-query';
import {
  Building2,
  CreditCard,
  LifeBuoy,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RootState, AppDispatch } from '@/core/store';
import { setTheme, toggleSidebar } from '@/core/store/uiSlice';
import { useAuth } from '@/core/hooks/useAuth';
import { buildOrganizationPath } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { usePermissions } from '@/core/hooks/usePermissions';
import { useSupportUnreadCount } from '@/modules/support/useSupportDesk';



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

interface TopbarProps {
  onOpenSidebar?: () => void;
}

function isOrganizationScopedQuery(query: Query) {
  const [root] = query.queryKey;
  return typeof root === 'string' && ORG_SCOPED_QUERY_ROOTS.has(root);
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const sidebarCollapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { activeOrganization } = useOrganizationContext(null, !isAdmin);
  const { canOrganization } = usePermissions();
  const canReadSupport = canOrganization('support', 'read');
  const supportUnreadCount = useSupportUnreadCount(activeOrganization?.id, canReadSupport);
  const supportUnread = supportUnreadCount.data || 0;
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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-4 md:px-5 xl:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-muted-foreground shadow-none md:hidden"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden rounded-xl text-muted-foreground shadow-none hover:bg-accent hover:text-foreground md:inline-flex"
            onClick={() => dispatch(toggleSidebar())}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canReadSupport ? (
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => navigateToScopedPath('/support')}
            >
              <LifeBuoy className="h-4 w-4" />
              {supportUnread > 0 ? (
                <Badge variant="destructive" className="absolute -right-1 -top-1 min-w-5 px-1.5 text-[10px]">
                  {supportUnread}
                </Badge>
              ) : null}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground shadow-none hover:bg-accent hover:text-foreground">
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : theme === 'light' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-2">
              <DropdownMenuItem className="rounded-lg" onClick={() => dispatch(setTheme('light'))}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg" onClick={() => dispatch(setTheme('dark'))}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg" onClick={() => dispatch(setTheme('system'))}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 rounded-xl px-1.5 shadow-none hover:bg-accent sm:pr-1.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.first_name || 'User'} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
              <DropdownMenuLabel className="px-2 py-1">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canOrganization('organizations', 'read') ? (
                <DropdownMenuItem className="rounded-lg" onClick={() => navigate('/organizations')}>
                  <Building2 className="mr-2 h-4 w-4" />
                  {t('nav.organizations')}
                </DropdownMenuItem>
              ) : null}
              {canOrganization('subscription', 'read') ? (
                <DropdownMenuItem className="rounded-lg" onClick={() => navigateToScopedPath('/subscription')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('nav.subscription')}
                </DropdownMenuItem>
              ) : null}
              {canOrganization('settings', 'read') ? (
                <DropdownMenuItem className="rounded-lg" onClick={() => navigateToScopedPath('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('nav.settings')}
                </DropdownMenuItem>
              ) : null}
              {canReadSupport ? (
                <DropdownMenuItem className="rounded-lg lg:hidden" onClick={() => navigateToScopedPath('/support')}>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Support
                  {supportUnread > 0 ? (
                    <Badge variant="destructive" className="ml-auto min-w-5 px-1.5 text-[10px]">
                      {supportUnread}
                    </Badge>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-lg text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
