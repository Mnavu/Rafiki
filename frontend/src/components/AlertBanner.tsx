import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing, typography } from '@theme/index';

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info';

const variantColor: Record<AlertVariant, string> = {
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.accent,
};

interface AlertBannerProps {
  message: string;
  variant?: AlertVariant;
  icon?: React.ReactNode;
  speakOnMount?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ message, variant = 'info', icon }) => {
  return (
    <View
      style={[styles.container, { borderLeftColor: variantColor[variant] }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderLeftWidth: 6,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  icon: {
    width: 32,
    alignItems: 'center',
  },
  text: {
    ...typography.body,
    color: palette.textPrimary,
    flex: 1,
  },
});
