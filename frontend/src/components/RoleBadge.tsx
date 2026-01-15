import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing, typography, roleColors } from '@theme/index';

interface RoleBadgeProps {
  role: keyof typeof roleColors;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <View
    style={[styles.container, { backgroundColor: roleColors[role] }]}
    accessibilityRole="text"
    accessibilityLabel={`Current role ${role}`}
  >
    <Text style={styles.text}>{role.toUpperCase()}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    ...typography.helper,
    color: palette.surface,
    letterSpacing: 1.2,
  },
});
