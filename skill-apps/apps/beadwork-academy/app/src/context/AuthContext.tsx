import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityPrefsProvider } from "@skillapp-core/ui";

import { ApiUser, fetchMe, login as apiLogin, updateMe } from "../services/api";

const STORAGE_KEY = "beadworkacademy.auth";

type AuthState = {
  user: ApiUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextValue = AuthState & {
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, refreshToken: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: AuthState = JSON.parse(raw);
          setState(parsed);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next: AuthState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const login = async (username: string, password: string) => {
    setError(null);
    try {
      const tokens = await apiLogin(username, password);
      const user = await fetchMe(tokens.access);
      await persist({ user, accessToken: tokens.access, refreshToken: tokens.refresh });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const logout = async () => {
    await persist({ user: null, accessToken: null, refreshToken: null });
  };

  const handleAccessibilityChange = (prefs: { simpleMode: boolean; highContrast: boolean; speechRate: number }) => {
    if (!state.user || !state.accessToken) return;
    const patch = {
      prefers_simple_language: prefs.simpleMode,
      prefers_high_contrast: prefs.highContrast,
      speech_rate: prefs.speechRate,
    };
    setState((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev));
    updateMe(state.accessToken, patch).catch(() => {
      // Best-effort sync; the local toggle already reflects the user's choice.
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, loading, error, login, logout }),
    [state, loading, error]
  );

  return (
    <AuthContext.Provider value={value}>
      <AccessibilityPrefsProvider
        key={state.user?.id ?? "anon"}
        initialPrefs={
          state.user
            ? {
                simpleMode: state.user.prefers_simple_language,
                highContrast: state.user.prefers_high_contrast,
                speechRate: state.user.speech_rate,
              }
            : undefined
        }
        onChange={handleAccessibilityChange}
      >
        {children}
      </AccessibilityPrefsProvider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
