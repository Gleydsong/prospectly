import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  bootstrapped: boolean;
  setAuth: (payload: { user: AuthUser; accessToken: string }) => void;
  setAccessToken: (accessToken: string) => void;
  setBootstrapped: (bootstrapped: boolean) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      bootstrapped: false,
      setAuth: ({ user, accessToken }) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setBootstrapped: (bootstrapped) => set({ bootstrapped }),
      updateUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      clear: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'prospectly-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
