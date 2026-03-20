import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { palette, radius, spacing, typography } from '@theme/index';

export const WebOnlyAdminNoticeScreen: React.FC = () => {
  const { state, logout, updatePreferences } = useAuth();

  return (
    <View style={styles.container}>
      <GreetingHeader
        name={state.user?.display_name?.trim() || state.user?.username || 'Admin'}
        greeting="Web admin only"
        rightAccessory={<RoleBadge role={state.user?.role === 'superadmin' ? 'superadmin' : 'admin'} />}
      />

      <View style={styles.noticeCard}>
        <Text style={styles.title}>Admin controls now live in the web workspace.</Text>
        <Text style={styles.body}>
          This mobile app no longer exposes admin and super admin portals. Use the web build to manage users,
          reports, monitoring, and policy from one organized control center.
        </Text>
        <VoiceButton label="Log out on this device" onPress={logout} />
      </View>

      <DashboardTile
        title="Use the web build"
        subtitle="Open the Expo web app or deployed web admin workspace, then sign in with the same account."
        disabled
      />

      <AppMenu
        actions={[{ label: 'Log out', onPress: logout }]}
        simpleMode={state.user?.prefers_simple_language !== false}
        highContrast={state.user?.prefers_high_contrast === true}
        onToggleSimpleMode={() =>
          updatePreferences({
            prefers_simple_language: !(state.user?.prefers_simple_language !== false),
          })
        }
        onToggleHighContrast={() =>
          updatePreferences({
            prefers_high_contrast: !(state.user?.prefers_high_contrast === true),
          })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  noticeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D7E4FF',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.headingL,
    color: palette.textPrimary,
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
  },
});
