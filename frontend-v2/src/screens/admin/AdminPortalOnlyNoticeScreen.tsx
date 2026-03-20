import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { palette, spacing, typography } from '@theme/index';

export const AdminPortalOnlyNoticeScreen: React.FC = () => {
  const { state, logout } = useAuth();

  return (
    <View style={styles.container}>
      <GreetingHeader
        name={state.user?.display_name || state.user?.username || 'User'}
        greeting="Admin workspace only"
        rightAccessory={<RoleBadge role={state.user?.role ?? 'admin'} />}
      />
      <View style={styles.card}>
        <Text style={styles.title}>This web deployment is restricted to admin accounts.</Text>
        <Text style={styles.body}>
          {`The deployed web portal is reserved for admin and super admin work. This ${state.user?.role ?? 'user'} account should use the mobile app instead.`}
        </Text>
        <VoiceButton label="Sign out" onPress={() => void logout()} isActive />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
  },
  title: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
  },
});
