import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, radius, spacing, typography, roleColors } from '@theme/index';
import type { Role } from '@app-types/roles';
import { roleLabels } from '@app-types/roles';

interface RoleBadgeProps {
  role: Role;
}

const roleBadgeLabels: Record<Role, string> = {
  student: 'STUDENT',
  parent: 'GUARDIAN',
  lecturer: 'LECTURER',
  hod: 'HOD',
  finance: 'FINANCE',
  records: 'RECORDS',
  admin: 'ADMIN',
  superadmin: 'SUPER ADMIN',
  librarian: 'LIBRARIAN',
  guest: 'GUEST',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <View
    style={[styles.container, { backgroundColor: roleColors[role] }]}
    accessibilityRole="text"
    accessibilityLabel={`Current role ${roleLabels[role]}`}
  >
    <Text style={styles.text}>{roleBadgeLabels[role]}</Text>
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
