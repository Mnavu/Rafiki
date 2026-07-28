import { useAccessibilityPrefs } from "../context/AccessibilityPrefsContext";
import type { Palette } from "../theme/colors";

export function useActivePalette(): Palette {
  return useAccessibilityPrefs().activePalette;
}
