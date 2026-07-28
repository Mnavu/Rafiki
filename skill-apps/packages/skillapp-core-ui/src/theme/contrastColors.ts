/**
 * High-contrast palette. This is the fix for a confirmed bug in Nanu's
 * frontend-v2/src/components/AppMenu.tsx, where the "High contrast" toggle
 * only changed its own label text and never applied a different theme.
 * Same shape as `palette` in colors.ts (a real swap-in, not a cosmetic no-op) -
 * near-black text on pure white, saturated/darker accents, thick dark borders.
 */
import type { Palette } from "./colors";

export const contrastColors: Palette = {
  primary: "#7A2E00",
  primaryDark: "#4A1B00",
  secondary: "#00453A",
  accent: "#B8860B",
  background: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#000000",
  textMuted: "#1A1A1A",
  success: "#0B5E2E",
  warning: "#7A4E00",
  danger: "#7A0000",
  disabled: "#4D4D4D",
  border: "#000000",
};
