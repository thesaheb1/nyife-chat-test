import { useEffect, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from '@/core/store';
import { QueryProvider } from './QueryProvider';
import { SocketProvider } from './SocketProvider';
import { ThemeProvider } from './ThemeProvider';
import { router } from '@/core/router';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { setCredentials, logout } from '@/core/store/authSlice';
import '@/core/i18n';

/**
 * Attempts to restore the user session by calling the refresh-token endpoint.
 * On success dispatches credentials; on failure dispatches logout
 * (which sets isLoading=false so guards stop showing the spinner).
 */
function AuthInitializer() {
  useEffect(() => {
    apiClient
      .post(ENDPOINTS.AUTH.REFRESH)
      .then(({ data }) => {
        store.dispatch(
          setCredentials({
            accessToken: data.data.accessToken,
            user: data.data.user,
          })
        );
      })
      .catch(() => {
        store.dispatch(logout());
      });
  }, []);
  return null;
}

export function AppProviders({ children }: { children?: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthInitializer />
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
