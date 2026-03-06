import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';

type Action = 'create' | 'read' | 'update' | 'delete';

export function usePermissions() {
  const user = useSelector((state: RootState) => state.auth.user);

  const can = (_resource: string, _action: Action): boolean => {
    if (!user) return false;
    // Owners and admins have full access
    if (user.role === 'user' || user.role === 'admin' || user.role === 'super_admin') {
      return true;
    }
    return false;
  };

  const isOwner = user?.role === 'user';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return { can, isOwner, isAdmin, user };
}
