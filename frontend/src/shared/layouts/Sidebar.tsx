import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  FileText,
  Workflow,
  Megaphone,
  MessageSquare,
  UserCog,
  Zap,
  Building2,
  LifeBuoy,
  Wallet,
  CreditCard,
  Settings,
  Code2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { toggleSidebar } from '@/core/store/uiSlice';
import { buildOrganizationPath } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { usePermissions } from '@/core/hooks/usePermissions';
import { useSupportUnreadCount } from '@/modules/support/useSupportDesk';

const NAV_ITEMS = [
  { path: '/dashboard', i18nKey: 'nav.dashboard', icon: LayoutDashboard, resource: 'dashboard' },
  { path: '/contacts', i18nKey: 'nav.contacts', icon: Users, resource: 'contacts' },
  { path: '/templates', i18nKey: 'nav.templates', icon: FileText, resource: 'templates' },
  { path: '/flows', i18nKey: 'nav.flows', icon: Workflow, resource: 'flows' },
  { path: '/campaigns', i18nKey: 'nav.campaigns', icon: Megaphone, resource: 'campaigns' },
  { path: '/chat', i18nKey: 'nav.chat', icon: MessageSquare, badge: true, resource: 'chat' },
  { path: '/team', i18nKey: 'nav.teamMembers', icon: UserCog, resource: 'team_members' },
  { path: '/automations', i18nKey: 'nav.automations', icon: Zap, resource: 'automations' },
  { path: '/organizations', i18nKey: 'nav.organizations', icon: Building2, resource: 'organizations' },
  { path: '/support', i18nKey: 'nav.support', icon: LifeBuoy, resource: 'support' },
  { path: '/wallet', i18nKey: 'nav.wallet', icon: Wallet, resource: 'wallet' },
  { path: '/subscription', i18nKey: 'nav.subscription', icon: CreditCard, resource: 'subscription' },
  { path: '/settings', i18nKey: 'nav.settings', icon: Settings, resource: 'settings' },
  { path: '/developer', i18nKey: 'nav.developer', icon: Code2, resource: 'developer' },
] as const;

export function Sidebar() {
  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const currentScopedPath = location.pathname.startsWith('/org/')
    ? location.pathname.replace(/^\/org\/[^/]+/, '') || '/dashboard'
    : location.pathname;
  const { activeOrganization } = useOrganizationContext();
  const { canOrganization } = usePermissions();
  const canReadSupport = canOrganization('support', 'read');
  const supportUnreadCount = useSupportUnreadCount(activeOrganization?.id, canReadSupport);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && <span className="text-lg font-bold tracking-tight">Nyife</span>}
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', collapsed ? 'mx-auto' : 'ml-auto')}
          onClick={() => dispatch(toggleSidebar())}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.filter((item) => canOrganization(item.resource, 'read')).map((item) => {
            const resolvedPath = item.path === '/organizations' || !activeOrganization
              ? item.path
              : buildOrganizationPath(activeOrganization.slug, item.path);
            const isActive =
              currentScopedPath === item.path ||
              (item.path !== '/dashboard' && currentScopedPath.startsWith(item.path));
            const Icon = item.icon;
            const label = t(item.i18nKey);

            const linkContent = (
              <Link
                to={resolvedPath}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
                {!collapsed && item.path === '/support' && (supportUnreadCount.data || 0) > 0 ? (
                  <Badge variant="destructive" className="ml-auto min-w-5 px-1.5 text-[10px]">
                    {supportUnreadCount.data}
                  </Badge>
                ) : null}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center gap-2">
                    <span>{label}</span>
                    {item.path === '/support' && (supportUnreadCount.data || 0) > 0 ? (
                      <Badge variant="destructive" className="min-w-5 px-1.5 text-[10px]">
                        {supportUnreadCount.data}
                      </Badge>
                    ) : null}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
