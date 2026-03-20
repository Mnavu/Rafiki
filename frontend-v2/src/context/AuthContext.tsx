import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role } from '@app-types/roles';
import { fetchProfile, loginRequest, type ApiUser } from '@services/api';

type AuthState = {
  user: ApiUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type LoginParams = {
  username: string;
  password: string;
  roleHint?: Role;
};

type SavedCredentials = {
  role: Role;
  username: string;
  password: string;
  lastUsedAt: string;
};

type AuthContextValue = {
  state: AuthState;
  loading: boolean;
  isAuthenticated: boolean;
  login: (params: LoginParams) => Promise<{ success: boolean; error?: string }>;
  getSavedCredentials: (role: Role) => Promise<SavedCredentials | null>;
  getRecentCredentials: (role?: Role) => Promise<SavedCredentials[]>;
  updatePreferences: (prefs: {
    prefers_simple_language?: boolean;
    prefers_high_contrast?: boolean;
  }) => Promise<void>;
  applyProfileUpdate: (updatedUser: ApiUser, previousUsername?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const STORAGE_KEY = 'eduassistv2.auth';
const CREDENTIALS_KEY_PREFIX = 'eduassistv2.credentials';
const CREDENTIALS_RECENT_KEY = 'eduassistv2.credentials.recent';

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

  const getRecentCredentials = async (role?: Role): Promise<SavedCredentials[]> => {
    try {
      const raw = await AsyncStorage.getItem(CREDENTIALS_RECENT_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as SavedCredentials[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      const normalized = parsed.filter(
        (item) =>
          !!item &&
          typeof item.username === 'string' &&
          typeof item.password === 'string' &&
          typeof item.role === 'string',
      );
      if (!role) {
        return normalized;
      }
      return normalized.filter((item) => item.role === role);
    } catch (error) {
      console.warn('Failed to load recent credentials', error);
      return [];
    }
  };

  const getSavedCredentials = async (role: Role): Promise<SavedCredentials | null> => {
    try {
      const recent = await getRecentCredentials(role);
      if (recent.length > 0) {
        return recent[0];
      }
      const raw = await AsyncStorage.getItem(`${CREDENTIALS_KEY_PREFIX}.${role}`);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Omit<SavedCredentials, 'role' | 'lastUsedAt'>;
      if (!parsed?.username || !parsed?.password) {
        return null;
      }
      return {
        role,
        username: parsed.username,
        password: parsed.password,
        lastUsedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('Failed to load saved credentials', error);
      return null;
    }
  };

  const persistCredential = async (credential: SavedCredentials) => {
    await AsyncStorage.setItem(
      `${CREDENTIALS_KEY_PREFIX}.${credential.role}`,
      JSON.stringify({ username: credential.username, password: credential.password }),
    );
    const recent = await getRecentCredentials();
    const deduped = recent.filter(
      (item) =>
        !(
          item.role === credential.role &&
          item.username.toLowerCase() === credential.username.toLowerCase()
        ),
    );
    const next = [credential, ...deduped].slice(0, 20);
    await AsyncStorage.setItem(CREDENTIALS_RECENT_KEY, JSON.stringify(next));
  };

  const migrateSavedUsername = async (
    oldUsername: string,
    newUsername: string,
    role: Role,
  ): Promise<void> => {
    const oldNormalized = oldUsername.trim().toLowerCase();
    const newNormalized = newUsername.trim().toLowerCase();
    if (!oldNormalized || !newNormalized || oldNormalized === newNormalized) {
      return;
    }

    const recent = await getRecentCredentials();
    if (recent.length) {
      const updatedRecent = recent.map((item) =>
        item.username.trim().toLowerCase() === oldNormalized
          ? { ...item, username: newUsername.trim(), lastUsedAt: new Date().toISOString() }
          : item,
      );
      await AsyncStorage.setItem(CREDENTIALS_RECENT_KEY, JSON.stringify(updatedRecent));
    }

    const roleKey = `${CREDENTIALS_KEY_PREFIX}.${role}`;
    const roleRaw = await AsyncStorage.getItem(roleKey);
    if (roleRaw) {
      try {
        const parsed = JSON.parse(roleRaw) as { username?: string; password?: string };
        if (parsed.username?.trim().toLowerCase() === oldNormalized) {
          await AsyncStorage.setItem(
            roleKey,
            JSON.stringify({
              username: newUsername.trim(),
              password: parsed.password || '',
            }),
          );
        }
      } catch (error) {
        console.warn('Failed to migrate role credential username', error);
      }
    }
  };

  const updatePreferences = async (prefs: {
    prefers_simple_language?: boolean;
    prefers_high_contrast?: boolean;
  }) => {
    setState((current) => {
      if (!current.user) {
        return current;
      }
      return {
        ...current,
        user: {
          ...current.user,
          ...(prefs.prefers_simple_language !== undefined
            ? { prefers_simple_language: prefs.prefers_simple_language }
            : {}),
          ...(prefs.prefers_high_contrast !== undefined
            ? { prefers_high_contrast: prefs.prefers_high_contrast }
            : {}),
        },
      };
    });
  };

  const applyProfileUpdate = async (updatedUser: ApiUser, previousUsername?: string) => {
    const oldUsername = previousUsername?.trim() || state.user?.username || '';
    const nextUsername = updatedUser.username?.trim() || '';
    if (oldUsername && nextUsername && oldUsername.toLowerCase() !== nextUsername.toLowerCase()) {
      await migrateSavedUsername(oldUsername, nextUsername, updatedUser.role);
    }
    setState((current) => ({
      ...current,
      user: {
        ...(current.user ?? updatedUser),
        ...updatedUser,
      },
    }));
  };

  const login = async ({ username, password, roleHint }: LoginParams) => {
    setLoading(true);
    try {
      const tokens = await loginRequest({ username, password });
      const profile = await fetchProfile(tokens.access);
      setState({
        user: profile,
        accessToken: tokens.access,
        refreshToken: tokens.refresh ?? null,
      });
      const normalizedUsername = username.trim();
      const savedAt = new Date().toISOString();
      await persistCredential({
        role: profile.role,
        username: normalizedUsername,
        password,
        lastUsedAt: savedAt,
      });
      if (roleHint && roleHint !== profile.role) {
        await persistCredential({
          role: roleHint,
          username: normalizedUsername,
          password,
          lastUsedAt: savedAt,
        });
      }
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
      getSavedCredentials,
      getRecentCredentials,
      updatePreferences,
      applyProfileUpdate,
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
