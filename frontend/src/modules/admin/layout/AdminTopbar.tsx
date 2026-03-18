import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface AdminTopbarProps {
  onOpenSidebar?: () => void;
}

export function AdminTopbar({ onOpenSidebar }: AdminTopbarProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const sidebarCollapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);

  const initials = user
    ? `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.first_name || 'Admin'} />
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
                  <span className="text-xs text-muted-foreground">
                    {user?.role === 'super_admin' ? 'super_admin' : 'admin'}
                  </span>
                </div>
              </DropdownMenuLabel>
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
