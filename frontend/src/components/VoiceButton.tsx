import React from 'react';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing, typography } from '@theme/index';

interface VoiceButtonProps {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  isActive?: boolean;
  accessibilityHint?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  label,
  icon,
  onPress,
  onPressIn,
  onPressOut,
  isActive,
  accessibilityHint,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.75}
      style={[styles.container, isActive && styles.active]}
    >
      {icon}
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  active: {
    backgroundColor: palette.accent,
  },
  text: {
    ...typography.body,
    color: palette.surface,
  },
});
