import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { usePermissions } from '@/core/hooks/usePermissions';
import { useAdminSupportUnreadCount } from '@/modules/admin/support/useAdminSupport';
import { useAuth } from '@/core/hooks/useAuth';

interface AdminSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  path: string;
  i18nKey: string;
  icon: LucideIcon;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { path: '/admin/dashboard', i18nKey: 'admin.nav.dashboard', icon: LayoutDashboard, resource: 'dashboard', action: 'read' },
      { path: '/admin/support', i18nKey: 'admin.nav.support', icon: LifeBuoy, resource: 'support', action: 'read' },
      { path: '/admin/notifications', i18nKey: 'admin.nav.notifications', icon: Bell, resource: 'notifications', action: 'read' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/admin/users', i18nKey: 'admin.nav.users', icon: Users, resource: 'users', action: 'read' },
      { path: '/admin/plans', i18nKey: 'admin.nav.plans', icon: CreditCard, resource: 'plans', action: 'read' },
      { path: '/admin/sub-admins', i18nKey: 'admin.nav.subAdmins', icon: ShieldCheck, resource: 'sub_admins', action: 'read' },
      { path: '/admin/email', i18nKey: 'admin.nav.email', icon: Mail, resource: 'emails', action: 'create' },
      { path: '/admin/settings', i18nKey: 'admin.nav.settings', icon: Settings, resource: 'settings', action: 'read' },
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

export function AdminSidebar({ mobile = false, onNavigate }: AdminSidebarProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const isCompact = !mobile && collapsed;
  const { canAdmin } = usePermissions();
  const canReadSupport = canAdmin('support', 'read');
  const supportUnreadCount = useAdminSupportUnreadCount(canReadSupport);
  const supportUnread = supportUnreadCount.data || 0;

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAdmin(item.resource, item.action)),
  })).filter((section) => section.items.length > 0);

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
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/admin/dashboard' && location.pathname.startsWith(`${item.path}/`)) ||
                    (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
                  const label = t(item.i18nKey);

                  const content = (
                    <Link
                      to={item.path}
                      onClick={onNavigate}
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isCompact && 'justify-center px-0',
                        isActive
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCompact ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
                      {item.path === '/admin/support' && supportUnread > 0 ? (
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
                        {item.path === '/admin/support' && supportUnread > 0 ? (
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
              <AvatarImage src={user?.avatar_url || undefined} alt={user?.first_name || 'Admin'} />
              <AvatarFallback>
                {getInitials(`${user?.first_name || ''} ${user?.last_name || ''}`)}
              </AvatarFallback>
            </Avatar>

            {!isCompact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">Admin access</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
