import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, radius, spacing, typography } from '@theme/index';

type NotificationBellBadgeProps = {
  count?: number;
  compact?: boolean;
  onPress?: () => void;
};

const formatCount = (count: number) => {
  if (count > 99) {
    return '99+';
  }
  return String(count);
};

export const NotificationBellBadge: React.FC<NotificationBellBadgeProps> = ({
  count = 0,
  compact = false,
  onPress,
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            accessibilityLabel: `${count} unread notifications`,
            accessibilityHint: 'Opens your alerts and recent notifications.',
            activeOpacity: 0.8,
          }
        : {})}
      style={[styles.container, compact && styles.compactContainer]}
    >
      <MaterialCommunityIcons
        name="bell-outline"
        size={compact ? 18 : 22}
        color={palette.primary}
      />
      {count > 0 ? (
        <View style={[styles.badge, compact && styles.compactBadge]}>
          <Text style={styles.badgeText}>{formatCount(count)}</Text>
        </View>
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#D8E2F2',
  },
  compactContainer: {
    width: 38,
    height: 38,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -6,
    right: -6,
  },
  compactBadge: {
    minWidth: 20,
    height: 20,
    top: -5,
    right: -5,
  },
  badgeText: {
    ...typography.helper,
    color: palette.surface,
    fontWeight: '700',
  },
});
