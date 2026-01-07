import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useQueryClient } from '@tanstack/react-query';
import {
  loginRequest,
  fetchJson,
  endpoints,
  requestTotpSetup,
  activateTotp as activateTotpRequest,
  disableTotp as disableTotpRequest,
  assignUserRole,
  refreshToken as refreshTokenRequest,
  type ApiUser,
} from '@services/api';
import type { Role } from '@app-types/roles';
import jwt_decode from 'jwt-decode';

type UserProfile = {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  prefers_simple_language: boolean;
  prefers_high_contrast: boolean;
  speech_rate: number;
  must_change_password: boolean;
  totp_enabled: boolean;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
};

type AuthContextValue = {
  state: AuthState;
  isAuthenticated: boolean;
  biometricsAvailable: boolean;
  hasPendingBiometric: boolean;
  login: (params: {
    username: string;
    password: string;
    expectedRole: Role;
    totpCode?: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    requiresPasswordChange?: boolean;
  }>;
  logout: () => Promise<void>;
  loading: boolean;
  unlockWithBiometrics: () => Promise<boolean>;
  markPasswordUpdated: () => void;
  refreshProfile: () => Promise<void>;
  getTotpSetup: () => Promise<{ secret: string; otpauth_url: string; enabled: boolean }>;
  activateTotp: (code: string) => Promise<void>;
  disableTotp: (code: string) => Promise<void>;
  assignRole: (userId: number, role: Role) => Promise<ApiUser>;
};

const STORAGE_KEY = 'eduassist.auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    user: null,
  });
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const queryClient = useQueryClient();

  const isTokenExpired = (token: string | null): boolean => {
    if (!token) {
      return true;
    }
    try {
      const decoded: { exp: number } = jwt_decode(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  };

  const handleTokenRefresh = useCallback(async () => {
    if (!state.refreshToken) {
      return; // Can't refresh without a refresh token
    }

    if (!isTokenExpired(state.accessToken)) {
      return; // No need to refresh
    }

    try {
      const { access } = await refreshTokenRequest(state.refreshToken);
      setState((prev) => ({ ...prev, accessToken: access }));
    } catch (error) {
      console.warn('Token refresh failed, logging out.', error);
      logout();
    }
  }, [state.accessToken, state.refreshToken]);

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await AsyncStorage.getItem(STORAGE_KEY);
        if (payload) {
          const parsed: AuthState = JSON.parse(payload);
          if (parsed.user && typeof parsed.user.totp_enabled !== 'boolean') {
            parsed.user = { ...parsed.user, totp_enabled: false };
          }
          setState(parsed);

          if (parsed.refreshToken) {
            if (isTokenExpired(parsed.accessToken)) {
              try {
                const { access } = await refreshTokenRequest(parsed.refreshToken);
                parsed.accessToken = access;
                setState(parsed);
              } catch (e) {
                console.warn('Initial token refresh failed', e);
                // Will be logged out by the biometric check or subsequent actions
              }
            }
          }

          const hasTokens = !!parsed.accessToken && !!parsed.user;
          if (hasTokens) {
            try {
              const hasHardware = await LocalAuthentication.hasHardwareAsync();
              const isEnrolled = await LocalAuthentication.isEnrolledAsync();
              if (hasHardware && isEnrolled) {
                setBiometricsAvailable(true);
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Unlock EduAssist',
                  fallbackLabel: 'Use passcode',
                });
                if (result.success) {
                  setBiometricLocked(false);
                } else {
                  setBiometricLocked(true);
                }
              } else {
                setBiometricLocked(false);
                setBiometricsAvailable(false);
              }
            } catch (error) {
              console.warn('Biometric unlock failed', error);
              setBiometricLocked(false);
            }
          } else {
            setBiometricLocked(false);
            setBiometricsAvailable(false);
          }
        }
      } catch (error) {
        console.warn('Failed to read auth state', error);
      } finally {
        setBootstrapped(true);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) =>
      console.warn('Failed to persist auth state', error),
    );
  }, [state, bootstrapped]);

  const refreshProfile = useCallback(async () => {
    if (!state.accessToken) {
      return;
    }
    try {
      const profile = await fetchJson<UserProfile>(endpoints.me(), state.accessToken);
      setState((prev) => ({
        ...prev,
        user: profile,
      }));
      queryClient.setQueryData(['me', profile.id], profile);
    } catch (error) {
      console.warn('Failed to refresh profile', error);
    }
  }, [state.accessToken, queryClient]);

  const login = useCallback<AuthContextValue['login']>(
    async ({ username, password, expectedRole, totpCode }) => {
      setLoading(true);
      try {
        const tokenResponse = await loginRequest({ username, password, totp_code: totpCode });
        const profile = await fetchJson<UserProfile>(endpoints.me(), tokenResponse.access);
        if (profile.role !== expectedRole) {
          return { success: false, error: `This account is assigned to the ${profile.role} role.` };
        }
        queryClient.clear();
        setState({
          accessToken: tokenResponse.access,
          refreshToken: tokenResponse.refresh,
          user: profile,
        });
        queryClient.setQueryData(['me', profile.id], profile);
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          setBiometricsAvailable(hasHardware && isEnrolled);
        } catch (error) {
          console.warn('Unable to determine biometric availability after login', error);
          setBiometricsAvailable(false);
        }
        setBiometricLocked(false);
        return { success: true, requiresPasswordChange: profile.must_change_password };
      } catch (error: any) {
        console.warn('Login error', error);
        return { success: false, error: error?.message ?? 'Unable to sign in' };
      } finally {
        setLoading(false);
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    queryClient.clear();
    setState({ accessToken: null, refreshToken: null, user: null });
    setBiometricLocked(false);
    setBiometricsAvailable(false);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, [queryClient]);

  const markPasswordUpdated = useCallback(() => {
    setState((prev) => {
      if (!prev.user) {
        return prev;
      }
      return {
        ...prev,
        user: { ...prev.user, must_change_password: false },
      };
    });
  }, []);

  const getTotpSetup = useCallback(async () => {
    if (!state.accessToken) {
      throw new Error('Not authenticated');
    }
    const response = await requestTotpSetup(state.accessToken);
    return response;
  }, [state.accessToken]);

  const activateTotp = useCallback(
    async (code: string) => {
      if (!state.accessToken) {
        throw new Error('Not authenticated');
      }
      await activateTotpRequest(state.accessToken, code);
      setState((prev) => {
        if (!prev.user) {
          return prev;
        }
        return {
          ...prev,
          user: { ...prev.user, totp_enabled: true },
        };
      });
    },
    [state.accessToken],
  );

  const disableTotp = useCallback(
    async (code: string) => {
      if (!state.accessToken) {
        throw new Error('Not authenticated');
      }
      await disableTotpRequest(state.accessToken, code);
      setState((prev) => {
        if (!prev.user) {
          return prev;
        }
        return {
          ...prev,
          user: { ...prev.user, totp_enabled: false },
        };
      });
    },
    [state.accessToken],
  );

  const unlockWithBiometrics = useCallback(async () => {
    if (!state.accessToken || !state.user) {
      return false;
    }
    try {
      setLoading(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock EduAssist',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) {
        setBiometricLocked(false);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Biometric authentication error', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [state.accessToken, state.user]);

  const assignRole = useCallback<AuthContextValue['assignRole']>(
    async (userId, role) => {
      if (!state.accessToken) {
        throw new Error('Not authenticated');
      }
      const updated = await assignUserRole(state.accessToken, userId, role);
      if (state.user && updated.id === state.user.id) {
        setState((prev) => ({
          ...prev,
          user: {
            ...prev.user!,
            role: updated.role,
          },
        }));
      }
      return updated;
    },
    [state.accessToken, state.user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isAuthenticated: !!state.accessToken && !!state.user && !biometricLocked,
      biometricsAvailable,
      hasPendingBiometric: !!state.accessToken && !!state.user && biometricLocked,
      login,
      logout,
      loading,
      unlockWithBiometrics,
      markPasswordUpdated,
      refreshProfile,
      getTotpSetup,
      activateTotp,
      disableTotp,
      assignRole,
    }),
    [
      state,
      biometricLocked,
      biometricsAvailable,
      login,
      logout,
      loading,
      unlockWithBiometrics,
      markPasswordUpdated,
      refreshProfile,
      getTotpSetup,
      activateTotp,
      disableTotp,
      assignRole,
    ],
  );

  if (!bootstrapped) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
