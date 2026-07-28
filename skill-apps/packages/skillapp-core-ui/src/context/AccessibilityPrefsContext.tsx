import React, { createContext, useContext, useMemo, useState } from "react";

import { contrastColors } from "../theme/contrastColors";
import { palette, type Palette } from "../theme/colors";

export type AccessibilityPrefs = {
  simpleMode: boolean;
  highContrast: boolean;
  speechRate: number;
};

type AccessibilityPrefsContextValue = AccessibilityPrefs & {
  activePalette: Palette;
  setSimpleMode: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setSpeechRate: (value: number) => void;
};

const DEFAULT_PREFS: AccessibilityPrefs = {
  simpleMode: true,
  highContrast: false,
  speechRate: 0.9,
};

const AccessibilityPrefsContext = createContext<AccessibilityPrefsContextValue | null>(null);

/**
 * Owns the app-wide accessibility state and, critically, the *real* palette
 * swap: every themed component should read colors via `useActivePalette()`
 * (or `useAccessibilityPrefs().activePalette`) instead of importing `palette`
 * directly, so toggling high contrast changes actual rendered colors - not
 * just a label, which was the confirmed bug in Nanu's AppMenu.
 */
export function AccessibilityPrefsProvider({
  initialPrefs,
  onChange,
  children,
}: {
  initialPrefs?: Partial<AccessibilityPrefs>;
  onChange?: (prefs: AccessibilityPrefs) => void;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>({ ...DEFAULT_PREFS, ...initialPrefs });

  const update = (patch: Partial<AccessibilityPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      onChange?.(next);
      return next;
    });
  };

  const value = useMemo<AccessibilityPrefsContextValue>(
    () => ({
      ...prefs,
      activePalette: prefs.highContrast ? contrastColors : palette,
      setSimpleMode: (v) => update({ simpleMode: v }),
      setHighContrast: (v) => update({ highContrast: v }),
      setSpeechRate: (v) => update({ speechRate: v }),
    }),
    [prefs]
  );

  return <AccessibilityPrefsContext.Provider value={value}>{children}</AccessibilityPrefsContext.Provider>;
}

export function useAccessibilityPrefs(): AccessibilityPrefsContextValue {
  const ctx = useContext(AccessibilityPrefsContext);
  if (!ctx) {
    throw new Error("useAccessibilityPrefs must be used within an AccessibilityPrefsProvider");
  }
  return ctx;
}
