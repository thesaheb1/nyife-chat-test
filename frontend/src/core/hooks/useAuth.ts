import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '@/core/store';
import { setCredentials, logout as logoutAction, setLoading } from '@/core/store/authSlice';
import { apiClient, refreshSession } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { User, ApiResponse } from '@/core/types';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post<ApiResponse<{ accessToken: string; user: User }>>(
      ENDPOINTS.AUTH.LOGIN,
      { email, password }
    );
    dispatch(setCredentials({ accessToken: data.data.accessToken, user: data.data.user }));
    return data;
  };

  const logout = async () => {
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    } finally {
      dispatch(logoutAction());
    }
  };

  const refreshAuth = async () => {
    try {
      dispatch(setLoading(true));
      await refreshSession();
    } catch {
      dispatch(logoutAction());
    }
  };

  return {
    ...auth,
    login,
    logout,
    refreshAuth,
  };
}
