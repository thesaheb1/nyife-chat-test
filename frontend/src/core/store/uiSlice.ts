import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  sidebarCollapsed: boolean;
  theme: Theme;
}

const SIDEBAR_COLLAPSED_KEY = 'nyife-sidebar-collapsed';

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('nyife-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
};

const getInitialSidebarCollapsed = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistSidebarCollapsed = (collapsed: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Ignore storage failures in restrictive environments.
  }
};

const initialState: UiState = {
  sidebarCollapsed: getInitialSidebarCollapsed(),
  theme: getInitialTheme(),
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      persistSidebarCollapsed(state.sidebarCollapsed);
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
      persistSidebarCollapsed(action.payload);
    },
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      localStorage.setItem('nyife-theme', action.payload);
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
