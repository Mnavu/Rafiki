export const palette = {
  primary: '#0057FF',
  secondary: '#FF7A00',
  success: '#2ECC71',
  warning: '#F2C94C',
  danger: '#EB5757',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  textPrimary: '#1F2A37',
  textSecondary: '#4B5563',
  disabled: '#D1D5DB',
  accent: '#7F56DA',
};

export const roleColors = {
  student: '#2563EB',
  parent: '#C026D3',
  lecturer: '#0D9488',
  hod: '#F97316',
  finance: '#0F172A',
  records: '#BE123C',
  admin: '#7C3AED',
  superadmin: '#0B4EA2',
  librarian: '#10B981',
  guest: '#6B7280',
};

export const themeColors = {
  background: palette.background,
  surface: palette.surface,
  text: palette.textPrimary,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  disabled: palette.disabled,
  border: '#E5E7EB',
};

const Colors = {
  light: {
    text: palette.textPrimary,
    background: palette.background,
    tint: palette.primary,
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: palette.primary,
  },
  tint: palette.primary,
};

export default Colors;
