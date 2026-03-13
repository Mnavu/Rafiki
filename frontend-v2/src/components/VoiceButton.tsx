import React from 'react';
import { TouchableOpacity, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, spacing, typography } from '@theme/index';

interface VoiceButtonProps {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  isActive?: boolean;
  accessibilityHint?: string;
  size?: 'default' | 'compact';
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  label,
  icon,
  onPress,
  isActive,
  accessibilityHint,
  size = 'default',
  iconOnly = false,
  style,
}) => {
  const showText = !iconOnly || !icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.75}
      style={[
        styles.container,
        size === 'compact' && styles.compactContainer,
        iconOnly && styles.iconOnlyContainer,
        isActive && styles.active,
        style,
      ]}
    >
      {icon}
      {showText ? (
        <Text style={[styles.text, size === 'compact' && styles.compactText]}>{label}</Text>
      ) : null}
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
  compactContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  iconOnlyContainer: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  text: {
    ...typography.body,
    color: palette.surface,
  },
  compactText: {
    ...typography.helper,
  },
});
