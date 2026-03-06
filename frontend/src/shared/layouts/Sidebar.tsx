import { Link, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  MessageSquare,
  Zap,
  Building2,
  LifeBuoy,
  Wallet,
  Settings,
  Code2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { RootState } from '@/core/store';
import { toggleSidebar } from '@/core/store/uiSlice';

const NAV_ITEMS = [
  { path: '/dashboard', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/contacts', i18nKey: 'nav.contacts', icon: Users },
  { path: '/templates', i18nKey: 'nav.templates', icon: FileText },
  { path: '/campaigns', i18nKey: 'nav.campaigns', icon: Megaphone },
  { path: '/chat', i18nKey: 'nav.chat', icon: MessageSquare, badge: true },
  { path: '/automations', i18nKey: 'nav.automations', icon: Zap },
  { path: '/organizations', i18nKey: 'nav.organizations', icon: Building2 },
  { path: '/support', i18nKey: 'nav.support', icon: LifeBuoy },
  { path: '/wallet', i18nKey: 'nav.wallet', icon: Wallet },
  { path: '/settings', i18nKey: 'nav.settings', icon: Settings },
  { path: '/developer', i18nKey: 'nav.developer', icon: Code2 },
] as const;

export function Sidebar() {
  const location = useLocation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);

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
          {NAV_ITEMS.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
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
    </aside>
  );
}
