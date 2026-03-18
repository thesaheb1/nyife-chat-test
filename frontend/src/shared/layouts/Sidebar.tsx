import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronsUpDown,
  Code2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Settings,
  UserCog,
  Users,
  Wallet,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { useAuth } from '@/core/hooks/useAuth';
import {
  buildOrganizationNavigationTarget,
  buildOrganizationPath,
  setStoredActiveOrganization,
} from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { usePermissions } from '@/core/hooks/usePermissions';
import { useSupportUnreadCount } from '@/modules/support/useSupportDesk';
import type { Organization } from '@/core/types';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  path: string;
  i18nKey: string;
  icon: LucideIcon;
  resource: string;
  matchPrefixes?: string[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', i18nKey: 'nav.dashboard', icon: LayoutDashboard, resource: 'dashboard' },
      { path: '/chat', i18nKey: 'nav.chat', icon: MessageSquare, resource: 'chat' },
      {
        path: '/contacts',
        i18nKey: 'nav.contacts',
        icon: Users,
        resource: 'contacts',
        matchPrefixes: ['/contacts', '/contacts/import'],
      },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { path: '/templates', i18nKey: 'nav.templates', icon: FileText, resource: 'templates' },
      { path: '/flows', i18nKey: 'nav.flows', icon: Workflow, resource: 'flows' },
      { path: '/campaigns', i18nKey: 'nav.campaigns', icon: Megaphone, resource: 'campaigns' },
      { path: '/automations', i18nKey: 'nav.automations', icon: Zap, resource: 'automations' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { path: '/team', i18nKey: 'nav.teamMembers', icon: UserCog, resource: 'team_members' },
      { path: '/organizations', i18nKey: 'nav.organizations', icon: Building2, resource: 'organizations' },
      { path: '/support', i18nKey: 'nav.support', icon: LifeBuoy, resource: 'support' },
      { path: '/wallet', i18nKey: 'nav.wallet', icon: Wallet, resource: 'wallet' },
      { path: '/subscription', i18nKey: 'nav.subscription', icon: CreditCard, resource: 'subscription' },
      { path: '/settings', i18nKey: 'nav.settings', icon: Settings, resource: 'settings' },
      { path: '/developer', i18nKey: 'nav.developer', icon: Code2, resource: 'developer' },
    ],
  },
];

function getInitials(value?: string | null) {
  if (!value) {
    return '?';
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function isActiveItem(currentPath: string, item: NavItem) {
  if (item.path === '/dashboard') {
    return currentPath === item.path;
  }

  const prefixes = item.matchPrefixes || [item.path];
  return prefixes.some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`));
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const isCompact = !mobile && collapsed;
  const currentScopedPath = location.pathname.startsWith('/org/')
    ? location.pathname.replace(/^\/org\/[^/]+/, '') || '/dashboard'
    : location.pathname;
  const { activeOrganization, organizations } = useOrganizationContext();
  const { canOrganization } = usePermissions();
  const canReadSupport = canOrganization('support', 'read');
  const supportUnreadCount = useSupportUnreadCount(activeOrganization?.id, canReadSupport);
  const supportUnread = supportUnreadCount.data || 0;

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canOrganization(item.resource, 'read')),
  })).filter((section) => section.items.length > 0);

  const handleOrganizationSwitch = (organization: Organization) => {
    setStoredActiveOrganization(user?.id, organization);
    navigate(
      buildOrganizationNavigationTarget(
        organization.slug,
        location.pathname,
        location.search,
        location.hash
      )
    );
    onNavigate?.();
  };

  const settingsPath = activeOrganization
    ? buildOrganizationPath(activeOrganization.slug, '/settings')
    : '/settings';
  const workspaceRole = activeOrganization
    ? activeOrganization.organization_role === 'owner'
      ? 'Owner workspace'
      : 'Team workspace'
    : 'No organization selected';

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col overflow-hidden border-r border-border/70 bg-background text-foreground',
        mobile ? 'h-full w-full shadow-xl shadow-slate-950/10' : 'h-screen transition-[width] duration-200 ease-out',
        isCompact ? 'w-[5.5rem]' : 'w-[17.5rem] xl:w-[18.5rem]'
      )}
    >
      <div className="border-b border-border/70 px-3 py-4">
        <div className='flex items-center gap-3 justify-center'>
          {isCompact ? (
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              <img src="/nyife.svg" alt="Nyife Admin" className="size-full object-contain" />
            </div>
          ) : <div className="flex h-10 w-auto shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <img src="/nyife-logo.svg" alt="Nyife Admin" className="size-full object-contain" />
          </div>}
        </div>

        <div className="mt-4">
          {!isCompact ? (
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Active Organization
            </p>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-auto rounded-xl border-border/70 bg-muted/20 text-foreground shadow-none hover:bg-muted/40 hover:text-foreground',
                  isCompact ? 'w-full justify-center px-0 py-3' : 'w-full justify-between px-3 py-3'
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar size={isCompact ? 'default' : 'lg'} className="ring-1 ring-border/70">
                    <AvatarImage src={activeOrganization?.logo_url || undefined} alt={activeOrganization?.name || 'Organization'} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(activeOrganization?.name || 'Organization')}
                    </AvatarFallback>
                  </Avatar>

                  {!isCompact ? (
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium">
                        {activeOrganization?.name || 'Organization'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {workspaceRole}
                      </span>
                    </span>
                  ) : null}
                </span>

                {!isCompact ? <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align={isCompact ? 'start' : 'center'}
              side={isCompact ? 'right' : 'bottom'}
              className="w-72 rounded-xl p-2"
            >
              <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Switch organization
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {organizations.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  className="rounded-lg px-2.5 py-2.5"
                  onClick={() => handleOrganizationSwitch(organization)}
                >
                  <Avatar className="ring-1 ring-border/70">
                    <AvatarImage src={organization.logo_url || undefined} alt={organization.name} />
                    <AvatarFallback>{getInitials(organization.name)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{organization.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {organization.organization_role === 'owner' ? 'Owner workspace' : 'Team workspace'}
                    </p>
                  </div>

                  {activeOrganization?.id === organization.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg px-2.5 py-2.5">
                <Link to="/organizations" onClick={onNavigate}>
                  <Building2 className="h-4 w-4" />
                  Manage organizations
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className={cn('space-y-5 px-2 py-4', !isCompact && 'px-3')}>
          {visibleSections.map((section) => (
            <div key={section.label} className="space-y-2">
              {!isCompact ? (
                <div className="px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {section.label}
                </div>
              ) : null}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveItem(currentScopedPath, item);
                  const label = t(item.i18nKey);
                  const resolvedPath = item.path === '/organizations' || !activeOrganization
                    ? item.path
                    : buildOrganizationPath(activeOrganization.slug, item.path);

                  const content = (
                    <Link
                      to={resolvedPath}
                      onClick={onNavigate}
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isCompact && 'justify-center px-0',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCompact ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
                      {item.path === '/support' && supportUnread > 0 ? (
                        <Badge
                          variant="destructive"
                          className={cn(
                            'min-w-5 px-1.5 text-[10px]',
                            isCompact ? 'absolute right-1 top-1' : 'ml-auto'
                          )}
                        >
                          {supportUnread}
                        </Badge>
                      ) : null}
                    </Link>
                  );

                  if (!isCompact) {
                    return <div key={item.path}>{content}</div>;
                  }

                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div className="relative">{content}</div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-2">
                        <span>{label}</span>
                        {item.path === '/support' && supportUnread > 0 ? (
                          <Badge variant="destructive" className="min-w-5 px-1.5 text-[10px]">
                            {supportUnread}
                          </Badge>
                        ) : null}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 px-3 py-4">
        <div className={cn(
          'rounded-xl border border-border/70 bg-muted/20 p-3',
          isCompact && 'flex flex-col items-center gap-2 p-2'
        )}>
          <div className={cn('flex items-center gap-3', isCompact && 'justify-center')}>
            <Avatar className="ring-1 ring-border/70">
              <AvatarImage src={user?.avatar_url || undefined} alt={user?.first_name || 'User'} />
              <AvatarFallback>
                {`${user?.first_name?.charAt(0) || ''}${user?.last_name?.charAt(0) || ''}`.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            {!isCompact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">{workspaceRole}</p>
              </div>
            ) : null}

            {!isCompact ? (
              <Button asChild variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground">
                <Link to={settingsPath} onClick={onNavigate}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>

          {!isCompact ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {organizations.length} accessible workspace{organizations.length === 1 ? '' : 's'}
            </p>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground">
                  <Link to={settingsPath} onClick={onNavigate}>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}
