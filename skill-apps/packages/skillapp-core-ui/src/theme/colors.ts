/**
 * Default palette. Flat object, no nested design-system - mirrors the shape
 * used across Nanu's frontend-v2/src/theme/colors.ts (a single-role app has
 * no need for that codebase's roleColors map).
 */
export const palette = {
  primary: "#B5651D",
  primaryDark: "#8C4A12",
  secondary: "#3D7A6B",
  accent: "#D9A441",
  background: "#FBF6EE",
  surface: "#FFFFFF",
  text: "#241B12",
  textMuted: "#6B5D4C",
  success: "#3E8E5A",
  warning: "#C9862C",
  danger: "#B23A2E",
  disabled: "#C9C0B2",
  border: "#E4D9C5",
};

export type Palette = typeof palette;
