import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role } from '@types/roles';
import { fetchProfile, loginRequest, type ApiUser } from '@services/api';

type AuthState = {
  user: ApiUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type LoginParams = {
  username: string;
  password: string;
  expectedRole: Role;
};

type AuthContextValue = {
  state: AuthState;
  loading: boolean;
  isAuthenticated: boolean;
  login: (params: LoginParams) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const STORAGE_KEY = 'eduassistv2.auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await AsyncStorage.getItem(STORAGE_KEY);
        if (payload) {
          const parsed = JSON.parse(payload) as AuthState;
          setState(parsed);
        }
      } catch (error) {
        console.warn('Failed to restore auth state', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) =>
      console.warn('Failed to persist auth state', error),
    );
  }, [state, loading]);

  const login = async ({ username, password, expectedRole }: LoginParams) => {
    setLoading(true);
    try {
      const tokens = await loginRequest({ username, password });
      const profile = await fetchProfile(tokens.access);
      if (profile.role !== expectedRole) {
        return { success: false, error: `This account is assigned to the ${profile.role} role.` };
      }
      setState({
        user: profile,
        accessToken: tokens.access,
        refreshToken: tokens.refresh ?? null,
      });
      return { success: true };
    } catch (error: any) {
      console.warn('Login error', error);
      return { success: false, error: error?.message ?? 'Unable to sign in' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setState({ user: null, accessToken: null, refreshToken: null });
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      loading,
      isAuthenticated: !!state.accessToken && !!state.user,
      login,
      logout,
    }),
    [state, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
