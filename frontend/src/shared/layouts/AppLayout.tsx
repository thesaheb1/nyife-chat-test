import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useNotificationSocket, useSupportSocket } from '@/core/hooks';

export function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global real-time listeners for notifications + campaign status
  useNotificationSocket();
  useSupportSocket();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-screen overflow-hidden bg-muted/20">
        <div className="hidden shrink-0 md:block">
          <Sidebar />
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[92vw] max-w-[340px] border-r-0 bg-transparent p-0 shadow-none md:hidden"
          >
            <Sidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-background">
          <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
          <main className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-4 sm:px-4 md:px-5 md:pb-5 xl:px-6 xl:pb-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
