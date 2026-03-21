import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform, Linking, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { palette, spacing } from '@theme/index';
import type { Role } from '@app-types/roles';
import { roleLabels } from '@app-types/roles';
import type { RootStackParamList } from '@navigation/AppNavigator';

type RoleOption = {
  key: Role;
  title: string;
  subtitle: string;
};

const roleOptions: RoleOption[] = [
  { key: 'student', title: roleLabels.student, subtitle: 'Follow schedules and submit work.' },
  { key: 'parent', title: roleLabels.parent, subtitle: 'Track learner progress, fees, and updates.' },
  { key: 'lecturer', title: roleLabels.lecturer, subtitle: 'Manage classes and share resources.' },
  { key: 'hod', title: roleLabels.hod, subtitle: 'Approve enrollments and monitor progress.' },
  { key: 'finance', title: roleLabels.finance, subtitle: 'Review invoices and payments.' },
  { key: 'records', title: roleLabels.records, subtitle: 'Handle transcripts and verifications.' },
  { key: 'admin', title: roleLabels.admin, subtitle: 'Manage users and system settings.' },
  {
    key: 'superadmin',
    title: roleLabels.superadmin,
    subtitle: 'Govern global roles, policy, and platform controls.',
  },
];

export const RoleSelectionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isAdminWebPortal =
    Platform.OS === 'web' && (process.env.EXPO_PUBLIC_WEB_PORTAL ?? '').trim().toLowerCase() === 'admin';
  const djangoAdminUrl = useMemo(() => {
    const base = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
    if (!base) {
      return 'https://rafiki-ygwg.onrender.com/admin/';
    }
    return `${base}/admin/`;
  }, []);
  const visibleRoles = useMemo(
    () =>
      roleOptions.filter((item) => {
        if (isAdminWebPortal) {
          return false;
        }
        if (Platform.OS !== 'web' && (item.key === 'admin' || item.key === 'superadmin')) {
          return false;
        }
        return true;
      }),
    [isAdminWebPortal],
  );

  return (
    <View style={styles.container}>
      <GreetingHeader
        name={isAdminWebPortal ? 'EduAssist Admin' : 'Guest'}
        greeting={isAdminWebPortal ? 'Choose admin access' : 'Choose your role'}
      />
      {isAdminWebPortal ? (
        <View style={styles.noticeCard}>
          <View style={styles.portalCard}>
            <Text style={styles.portalTitle}>Django admin is the primary web workspace.</Text>
            <Text style={styles.portalBody}>
              Admin and superadmin users should use Django admin for approvals, finance, reports,
              audit logs, and password resets. The custom web workspace is now legacy.
            </Text>
            <VoiceButton
              label="Open Django admin"
              onPress={() => {
                void Linking.openURL(djangoAdminUrl);
              }}
              isActive
            />
            <VoiceButton
              label="Open legacy workspace"
              onPress={() => navigation.navigate('Login', { role: 'admin' })}
              size="compact"
            />
            <Text style={styles.portalLink}>{djangoAdminUrl}</Text>
          </View>
        </View>
      ) : null}
      <FlatList
        data={visibleRoles}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <DashboardTile
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => navigation.navigate('Login', { role: item.key })}
            icon={<RoleBadge role={item.key} />}
          />
        )}
      />
    </View>
  );
};

const Separator: React.FC = () => <View style={{ height: spacing.md }} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  noticeCard: {
    marginBottom: spacing.md,
  },
  portalCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.disabled,
    padding: spacing.lg,
    gap: spacing.md,
  },
  portalTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  portalBody: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: palette.textSecondary,
  },
  portalLink: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: palette.textSecondary,
  },
});
