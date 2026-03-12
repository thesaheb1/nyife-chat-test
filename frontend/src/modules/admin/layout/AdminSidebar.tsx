import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  Bell,
  Mail,
  Settings,
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { toggleSidebar } from '@/core/store/uiSlice';
import { usePermissions } from '@/core/hooks/usePermissions';

const NAV_ITEMS = [
  { path: '/admin/dashboard', i18nKey: 'admin.nav.dashboard', icon: LayoutDashboard, resource: 'dashboard', action: 'read' },
  { path: '/admin/users', i18nKey: 'admin.nav.users', icon: Users, resource: 'users', action: 'read' },
  { path: '/admin/plans', i18nKey: 'admin.nav.plans', icon: CreditCard, resource: 'plans', action: 'read' },
  { path: '/admin/support', i18nKey: 'admin.nav.support', icon: LifeBuoy, resource: 'support', action: 'read' },
  { path: '/admin/sub-admins', i18nKey: 'admin.nav.subAdmins', icon: ShieldCheck, resource: 'sub_admins', action: 'read' },
  { path: '/admin/notifications', i18nKey: 'admin.nav.notifications', icon: Bell, resource: 'notifications', action: 'read' },
  { path: '/admin/email', i18nKey: 'admin.nav.email', icon: Mail, resource: 'emails', action: 'create' },
  { path: '/admin/settings', i18nKey: 'admin.nav.settings', icon: Settings, resource: 'settings', action: 'read' },
] as const;

export function AdminSidebar() {
  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const { canAdmin } = usePermissions();

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && <span className="text-lg font-bold tracking-tight text-red-500">Admin</span>}
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
          {NAV_ITEMS.filter((item) => canAdmin(item.resource, item.action)).map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            const label = t(item.i18nKey);

            const linkContent = (
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}
        </nav>
      </ScrollArea>

      {/* Back to App */}
      <Separator />
      <div className="p-2">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard"
                className="flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t('admin.backToApp')}</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>{t('admin.backToApp')}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
