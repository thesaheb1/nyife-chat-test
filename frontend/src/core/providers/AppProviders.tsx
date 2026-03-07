import { useEffect, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { store } from '@/core/store';
import { QueryProvider } from './QueryProvider';
import { SocketProvider } from './SocketProvider';
import { ThemeProvider } from './ThemeProvider';
import { router } from '@/core/router';
import { refreshSession } from '@/core/api/client';
import '@/core/i18n';

/**
 * Attempts to restore the user session by calling the refresh-token endpoint.
 * On success dispatches credentials; on failure dispatches logout
 * (which sets isLoading=false so guards stop showing the spinner).
 */
function AuthInitializer() {
  useEffect(() => {
    void initializeAuthSession();
  }, []);
  return null;
}

let authInitializationPromise: Promise<void> | null = null;
let hasAttemptedAuthInitialization = false;

function initializeAuthSession() {
  if (hasAttemptedAuthInitialization) {
    return authInitializationPromise ?? Promise.resolve();
  }

  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = (async () => {
    try {
      await refreshSession();
    } catch {
      // refreshSession already clears auth state on failure
    } finally {
      hasAttemptedAuthInitialization = true;
      authInitializationPromise = null;
    }
  })();

  return authInitializationPromise;
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
