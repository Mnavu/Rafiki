import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
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
  type ApiUser,
} from '@services/api';
import type { Role } from '@app-types/roles';

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
    user: null,
  });
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const queryClient = useQueryClient();



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
                    
                                                  
                                        const hasUser = !!parsed.user;
                                        if (hasUser) {
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
                                        }                            }          } catch (error) {
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
    try {
      const profile = await fetchJson<UserProfile>(endpoints.me(), '');
      setState((prev) => ({
        ...prev,
        user: profile,
      }));
      queryClient.setQueryData(['me', profile.id], profile);
    } catch (error) {
      console.warn('Failed to refresh profile', error);
    }
  }, [queryClient]);

  const login = useCallback<AuthContextValue['login']>(
    async ({ username, password, expectedRole, totpCode }) => {
      setLoading(true);
      try {
        const profile = await loginRequest({ username, password, totp_code: totpCode });
        if (profile.role !== expectedRole) {
          return { success: false, error: `This account is assigned to the ${profile.role} role.` };
        }
        queryClient.clear();
        setState({
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
    setState({ user: null });
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
    const response = await requestTotpSetup('');
    return response;
  }, []);

  const activateTotp = useCallback(
    async (code: string) => {
      await activateTotpRequest('', code);
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
    [],
  );

  const disableTotp = useCallback(
    async (code: string) => {
      await disableTotpRequest('', code);
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
    [],
  );

  const unlockWithBiometrics = useCallback(async () => {
    if (!state.user) {
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
  }, [state.user]);

  const assignRole = useCallback<AuthContextValue['assignRole']>(
    async (userId, role) => {
      const updated = await assignUserRole('', userId, role);
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
    [state.user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      isAuthenticated: !!state.user && !biometricLocked,
      biometricsAvailable,
      hasPendingBiometric: !!state.user && biometricLocked,
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
