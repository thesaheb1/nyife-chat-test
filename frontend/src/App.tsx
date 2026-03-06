import { useEffect } from 'react';
import { useAuth } from '@/core/hooks/useAuth';

function App() {
  const { refreshAuth } = useAuth();

  // Attempt to restore session on app load
  useEffect(() => {
    refreshAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // Router is rendered by AppProviders via RouterProvider
}

export default App;
