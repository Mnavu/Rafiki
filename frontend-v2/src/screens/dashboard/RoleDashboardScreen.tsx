import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { palette, spacing } from '@theme/index';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { Role } from '@types/roles';
import { roleLabels } from '@types/roles';
import { useAuth } from '@context/AuthContext';

type DashboardRoute = RouteProp<RootStackParamList, 'Dashboard'>;

type Tile = {
  title: string;
  subtitle: string;
};

const tilesByRole: Record<Role, Tile[]> = {
  student: [
    { title: 'My Timetable', subtitle: "See today's classes and reminders." },
    { title: 'Assignments', subtitle: 'Check due work and submit easily.' },
    { title: 'Library', subtitle: 'Open picture-heavy resources.' },
    { title: 'Rewards Hub', subtitle: 'Track your star balance.' },
  ],
  parent: [
    { title: 'Progress', subtitle: 'Review attendance and grades.' },
    { title: 'Fees', subtitle: 'Monitor balances and payments.' },
    { title: 'Messages', subtitle: 'Chat with lecturers.' },
  ],
  lecturer: [
    { title: 'Classes', subtitle: 'Manage course rosters.' },
    { title: 'Assignments', subtitle: 'Upload and grade work.' },
    { title: 'Messages', subtitle: 'Respond to learners.' },
  ],
  hod: [
    { title: 'Approvals', subtitle: 'Review enrollment requests.' },
    { title: 'Reports', subtitle: 'Track performance snapshots.' },
    { title: 'Staff', subtitle: 'Manage lecturer workloads.' },
  ],
  finance: [
    { title: 'Invoices', subtitle: 'Create and manage fee items.' },
    { title: 'Payments', subtitle: 'Log and reconcile payments.' },
    { title: 'Alerts', subtitle: 'Review outstanding balances.' },
  ],
  records: [
    { title: 'Transcripts', subtitle: 'Generate student records.' },
    { title: 'Verifications', subtitle: 'Validate credentials.' },
    { title: 'Enrollment', subtitle: 'Manage intake workflow.' },
  ],
  admin: [
    { title: 'User Management', subtitle: 'Create and update accounts.' },
    { title: 'Audit Logs', subtitle: 'Track sensitive actions.' },
    { title: 'System Health', subtitle: 'Review usage snapshots.' },
  ],
  superadmin: [
    { title: 'Role Governance', subtitle: 'Assign elevated access.' },
    { title: 'Security', subtitle: 'Manage MFA requirements.' },
  ],
  librarian: [
    { title: 'Repository', subtitle: 'Curate learning resources.' },
    { title: 'Policies', subtitle: 'Manage access rules.' },
  ],
};

export const RoleDashboardScreen: React.FC = () => {
  const route = useRoute<DashboardRoute>();
  const { state, logout } = useAuth();
  const role = route.params.role;
  const userName =
    state.user?.display_name?.trim() || state.user?.username || roleLabels[role];

  const handleTilePress = (title: string) => {
    Alert.alert('Coming soon', `${title} is part of the next phase of the rebuild.`);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GreetingHeader
          name={userName}
          greeting={`Welcome, ${roleLabels[role]}`}
          rightAccessory={<RoleBadge role={role} />}
        />
        <View style={styles.tiles}>
          {tilesByRole[role].map((tile) => (
            <DashboardTile
              key={tile.title}
              title={tile.title}
              subtitle={tile.subtitle}
              onPress={() => handleTilePress(tile.title)}
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <VoiceButton label="Log out" onPress={logout} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  tiles: {
    gap: spacing.md,
  },
  actions: {
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
});
