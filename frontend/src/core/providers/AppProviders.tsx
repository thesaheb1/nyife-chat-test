import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from '@/core/store';
import { QueryProvider } from './QueryProvider';
import { SocketProvider } from './SocketProvider';
import { ThemeProvider } from './ThemeProvider';
import { router } from '@/core/router';
import '@/core/i18n';

export function AppProviders({ children }: { children?: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <QueryProvider>
        <ThemeProvider>
          <SocketProvider>
            <RouterProvider router={router} />
            <Toaster richColors position="top-right" />
            {children}
          </SocketProvider>
        </ThemeProvider>
      </QueryProvider>
    </ReduxProvider>
  );
}
