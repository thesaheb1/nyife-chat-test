import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useSupportSocket } from '@/core/hooks';

export function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useSupportSocket();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-screen overflow-hidden bg-muted/20">
        <div className="hidden shrink-0 md:block">
          <AdminSidebar />
        </div>

        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[92vw] max-w-[340px] border-r-0 bg-transparent p-0 shadow-none md:hidden"
          >
            <AdminSidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-background">
          <AdminTopbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
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
