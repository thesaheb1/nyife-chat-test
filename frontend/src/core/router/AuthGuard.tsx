import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';

export function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.must_change_password && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace />;
  }

  if (!user?.must_change_password && location.pathname === '/force-change-password') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
