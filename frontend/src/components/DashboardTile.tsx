import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { palette, spacing, radius, typography } from '@theme/index';

interface DashboardTileProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  statusColor?: string;
  style?: ViewStyle;
  onLongPressSpeak?: () => void;
}

export const DashboardTile: React.FC<DashboardTileProps> = ({
  title,
  subtitle,
  onPress,
  icon,
  disabled,
  statusColor,
  style,
  onLongPressSpeak,
}) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPressSpeak}
      activeOpacity={0.8}
      disabled={disabled}
      style={[
        styles.container,
        style,
        disabled && styles.disabled,
        statusColor && { borderColor: statusColor },
      ]}
    >
      <View style={styles.iconWrapper}>{icon}</View>
      <View style={styles.textWrapper}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
    borderStyle: 'dashed',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.helper,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
});
