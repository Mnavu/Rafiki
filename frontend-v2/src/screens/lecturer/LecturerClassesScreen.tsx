import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchClassCalls,
  fetchLecturerClassesDashboard,
  type ClassCallSummary,
  type LecturerClassesDashboard,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const LecturerClassesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const [dashboard, setDashboard] = useState<LecturerClassesDashboard | null>(null);
  const [calls, setCalls] = useState<ClassCallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!state.accessToken) {
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const [dashboardPayload, upcomingCalls] = await Promise.all([
          fetchLecturerClassesDashboard(state.accessToken),
          fetchClassCalls(state.accessToken, 'upcoming').catch(() => []),
        ]);
        setDashboard(dashboardPayload);
        setCalls(upcomingCalls);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load lecturer class dashboard.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const lecturerName = useMemo(() => {
    return (
      dashboard?.lecturer.display_name ||
      state.user?.display_name?.trim() ||
      state.user?.username ||
      'Lecturer'
    );
  }, [dashboard, state.user]);

  if (loading && !dashboard) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading lecturer classes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />
        }
      >
        <GreetingHeader
          name={lecturerName}
          greeting="Classes overview"
          rightAccessory={<RoleBadge role="lecturer" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh class data</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadDashboard(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending priorities</Text>
          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Classes</Text>
              <Text style={styles.metricValue}>{dashboard?.totals.classes ?? 0}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Pending issuance</Text>
              <Text style={styles.metricValue}>{dashboard?.totals.pending_to_issue ?? 0}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Submissions to mark</Text>
              <Text style={styles.metricValue}>{dashboard?.totals.pending_to_mark ?? 0}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Messages waiting response</Text>
              <Text style={styles.metricValue}>{dashboard?.totals.pending_messages ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active class list</Text>
          {dashboard?.classes.length ? (
            dashboard.classes.map((item, index) => (
              <DashboardTile
                key={`lecturer-class-${item.unit_id}-${index}`}
                title={`${item.unit_code} - ${item.unit_title}`}
                subtitle={`Students ${item.students}  |  Pending issue ${item.pending_to_issue}  |  Marking ${item.pending_to_mark}`}
                onPress={() =>
                  navigation.navigate('LecturerClassDetail', {
                    unitId: item.unit_id,
                    unitTitle: `${item.unit_code} - ${item.unit_title}`,
                  })
                }
              />
            ))
          ) : (
            <DashboardTile
              title="No classes assigned"
              subtitle="Assigned classes will appear once HOD/records allocation is completed."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming class calls</Text>
          {calls.length ? (
            calls.slice(0, 5).map((call, index) => (
              <DashboardTile
                key={`lecturer-call-${call.id}-${index}`}
                title={`${call.unit_code} - ${call.title}`}
                subtitle={`${formatDateTime(call.start_at)}  |  ${call.meeting_url}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No scheduled calls"
              subtitle="Schedule class calls inside each class detail."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Assignments workspace', onPress: () => navigation.navigate('LecturerAssignments') },
          { label: 'Refresh dashboard', onPress: () => loadDashboard(true) },
          { label: 'Back', onPress: () => navigation.goBack() },
          { label: 'Log out', onPress: logout },
        ]}
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
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: spacing.md,
    padding: spacing.lg,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  metricsCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.body,
    color: palette.textPrimary,
  },
  errorCard: {
    backgroundColor: '#FEE4E2',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.headingM,
    color: palette.danger,
  },
  errorBody: {
    ...typography.helper,
    color: '#912018',
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
