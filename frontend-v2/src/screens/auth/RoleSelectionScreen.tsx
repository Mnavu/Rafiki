import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DashboardTile, GreetingHeader, RoleBadge } from '@components/index';
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
  const visibleRoles = useMemo(
    () =>
      roleOptions.filter((item) => {
        if (Platform.OS !== 'web' && (item.key === 'admin' || item.key === 'superadmin')) {
          return false;
        }
        return true;
      }),
    [],
  );

  return (
    <View style={styles.container}>
      <GreetingHeader name="Guest" greeting="Choose your role" />
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
});
