import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { featureCatalog, type FeatureDescriptor } from '@data/featureCatalog';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchAdminAnalytics,
  fetchAdminPipelineStudents,
  fetchCommunicationThreads,
  fetchDepartments,
  fetchFinancePayments,
  fetchHodPendingApprovals,
  fetchLecturerGradingQueue,
  fetchLibraryAssets,
  fetchNotifications,
  fetchParentStudentLinks,
  fetchProgrammes,
  fetchProvisionRequests,
  fetchStudentAssignments,
  fetchStudentFinanceStatuses,
  fetchStudentRegistrations,
  fetchStudentTimetable,
  fetchUsers,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import type { Role } from '@app-types/roles';
import { roleLabels } from '@app-types/roles';

type DashboardRoute = RouteProp<RootStackParamList, 'Dashboard'>;

type RoleMetric = {
  label: string;
  value: string;
};

type RoleHighlight = {
  title: string;
  subtitle: string;
};

type RoleSummary = {
  intro: string;
  metrics: RoleMetric[];
  highlights: RoleHighlight[];
};

const parseMillis = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCurrency = (value: string): string => {
  const number = Number.parseFloat(value);
  if (Number.isNaN(number)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(number);
};

const safeCall = async <T,>(action: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await action();
  } catch {
    return fallback;
  }
};

const fallbackSummary = (role: Role): RoleSummary => ({
  intro: `${roleLabels[role]} workspace is active. Module content has been loaded for this role.`,
  metrics: [{ label: 'Modules', value: String(featureCatalog[role].length) }],
  highlights: [
    {
      title: 'Module access ready',
      subtitle: 'Open a module below to view detailed content and live data snapshots.',
    },
  ],
});

const buildLecturerSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [assignments, submissions, threads, timetable] = await Promise.all([
    safeCall(() => fetchStudentAssignments(accessToken), []),
    safeCall(() => fetchLecturerGradingQueue(accessToken), []),
    safeCall(() => fetchCommunicationThreads(accessToken), []),
    safeCall(() => fetchStudentTimetable(accessToken), []),
  ]);
  const ungraded = submissions.filter((item) => item.grade === null || item.grade === '').length;
  const dueAssignments = [...assignments]
    .sort((left, right) => parseMillis(left.due_at) - parseMillis(right.due_at))
    .slice(0, 4);

  return {
    intro: 'Teaching operations summary with assignments, grading queue, and active conversations.',
    metrics: [
      { label: 'Assignments', value: String(assignments.length) },
      { label: 'Ungraded', value: String(ungraded) },
      { label: 'Threads', value: String(threads.length) },
      { label: 'Classes', value: String(timetable.length) },
    ],
    highlights:
      dueAssignments.length > 0
        ? dueAssignments.map((item) => ({
            title: item.title,
            subtitle: `${item.unit_title}  |  Due ${formatDateTime(item.due_at)}`,
          }))
        : [
            {
              title: 'No immediate assignment deadlines',
              subtitle: 'New assignments will appear here as they are published.',
            },
          ],
  };
};

const buildHodSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [approvals, departments, statuses, programmes] = await Promise.all([
    safeCall(() => fetchHodPendingApprovals(accessToken), []),
    safeCall(() => fetchDepartments(accessToken), []),
    safeCall(() => fetchStudentFinanceStatuses(accessToken), []),
    safeCall(() => fetchProgrammes(accessToken), []),
  ]);
  const blocked = statuses.filter((item) => item.clearance_status === 'blocked').length;
  const departmentHighlights = departments.slice(0, 3).map((department) => ({
    title: department.name,
    subtitle: `${department.code} department`,
  }));

  return {
    intro: 'Department visibility with approval queue, programme coverage, and finance readiness.',
    metrics: [
      { label: 'Pending approvals', value: String(approvals.length) },
      { label: 'Departments', value: String(departments.length) },
      { label: 'Programmes', value: String(programmes.length) },
      { label: 'Blocked finance', value: String(blocked) },
    ],
    highlights:
      approvals.length > 0
        ? approvals.slice(0, 5).map((item) => ({
            title: item.unit_title,
            subtitle: `${item.student_name || 'Student unavailable'}  |  ${item.status.replaceAll('_', ' ')}`,
          }))
        : departmentHighlights.length > 0
          ? departmentHighlights
          : [
              {
                title: 'No pending approvals',
                subtitle: 'Unit approvals and departmental load will appear here.',
              },
            ],
  };
};

const buildFinanceSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [statuses, payments, notifications] = await Promise.all([
    safeCall(() => fetchStudentFinanceStatuses(accessToken), []),
    safeCall(() => fetchFinancePayments(accessToken), []),
    safeCall(() => fetchNotifications(accessToken), []),
  ]);
  const blocked = statuses.filter((item) => item.clearance_status === 'blocked').length;
  const queued = notifications.filter((item) => item.status === 'queued').length;
  const recentPayments = [...payments]
    .sort((left, right) => parseMillis(right.created_at) - parseMillis(left.created_at))
    .slice(0, 5);

  return {
    intro: 'Finance operations snapshot across status records, payments, and alert queues.',
    metrics: [
      { label: 'Status rows', value: String(statuses.length) },
      { label: 'Payments', value: String(payments.length) },
      { label: 'Blocked', value: String(blocked) },
      { label: 'Queued alerts', value: String(queued) },
    ],
    highlights:
      recentPayments.length > 0
        ? recentPayments.map((item) => ({
            title: `Payment ${formatCurrency(item.amount)}`,
            subtitle: `Y${item.academic_year} T${item.trimester}  |  ${item.method || 'Unknown method'}`,
          }))
        : [
            {
              title: 'No recent payments',
              subtitle: 'Payment activity will appear once transactions are recorded.',
            },
          ],
  };
};

const buildRecordsSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [registrations, links, requests] = await Promise.all([
    safeCall(() => fetchStudentRegistrations(accessToken), []),
    safeCall(() => fetchParentStudentLinks(accessToken), []),
    safeCall(() => fetchProvisionRequests(accessToken), []),
  ]);
  const pending = registrations.filter((item) => item.status === 'pending_hod').length;
  const pendingRequests = requests.filter((item) => item.status === 'pending').length;

  return {
    intro: 'Records pipeline includes registrations, Guardian links, and provisioning queue status.',
    metrics: [
      { label: 'Registrations', value: String(registrations.length) },
      { label: 'Pending HOD', value: String(pending) },
      { label: 'Guardian links', value: String(links.length) },
      { label: 'Pending requests', value: String(pendingRequests) },
    ],
    highlights:
      registrations.length > 0
        ? registrations.slice(0, 5).map((item) => ({
            title: item.unit_title,
            subtitle: `${item.status.replaceAll('_', ' ')}  |  ${item.student_name || 'Student unavailable'}`,
          }))
        : [
            {
              title: 'No registration records',
              subtitle: 'Records data will appear as student workflows progress.',
            },
          ],
  };
};

const buildAdminSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [users, requests, analytics, pipeline] = await Promise.all([
    safeCall(() => fetchUsers(accessToken), []),
    safeCall(() => fetchProvisionRequests(accessToken), []),
    safeCall(() => fetchAdminAnalytics(accessToken), null),
    safeCall(() => fetchAdminPipelineStudents(accessToken), []),
  ]);
  const pending = requests.filter((item) => item.status === 'pending');
  const keyMetrics: RoleMetric[] = [
    { label: 'Users', value: String(users.length) },
    { label: 'Pending requests', value: String(pending.length) },
    { label: 'Pipeline students', value: String(pipeline.length) },
  ];
  if (analytics) {
    keyMetrics.push({ label: 'Weekly logins', value: String(analytics.weekly_logins) });
  }

  return {
    intro: 'Platform governance summary for access, approvals, analytics, and onboarding pipeline.',
    metrics: keyMetrics,
    highlights:
      pending.length > 0
        ? pending.slice(0, 5).map((item) => ({
            title: `${item.username} (${item.role})`,
            subtitle: `Pending since ${formatDateTime(item.created_at)}`,
          }))
        : pipeline.length > 0
          ? pipeline.slice(0, 5).map((item) => ({
              title: item.user.display_name || item.user.username,
              subtitle: `Status ${item.current_status}  |  Year ${item.year} Trimester ${item.trimester}`,
            }))
          : [
              {
                title: 'No pending governance items',
                subtitle: 'Provisioning and pipeline updates will appear here.',
              },
            ],
  };
};

const buildLibrarianSummary = async (accessToken: string): Promise<RoleSummary> => {
  const [assets, programmes, notifications] = await Promise.all([
    safeCall(() => fetchLibraryAssets(accessToken), []),
    safeCall(() => fetchProgrammes(accessToken), []),
    safeCall(() => fetchNotifications(accessToken), []),
  ]);

  return {
    intro: 'Library operations summary across assets, programme coverage, and outbound notices.',
    metrics: [
      { label: 'Assets', value: String(assets.length) },
      { label: 'Programmes', value: String(programmes.length) },
      { label: 'Notices', value: String(notifications.length) },
    ],
    highlights:
      assets.length > 0
        ? assets.slice(0, 5).map((asset) => ({
            title: asset.title,
            subtitle: `${asset.type.toUpperCase()}  |  ${asset.visibility} scope`,
          }))
        : [
            {
              title: 'No assets available',
              subtitle: 'Library resources will appear once content is uploaded.',
            },
          ],
  };
};

const buildRoleSummary = async (accessToken: string, role: Role): Promise<RoleSummary> => {
  switch (role) {
    case 'lecturer':
      return buildLecturerSummary(accessToken);
    case 'hod':
      return buildHodSummary(accessToken);
    case 'finance':
      return buildFinanceSummary(accessToken);
    case 'records':
      return buildRecordsSummary(accessToken);
    case 'admin':
    case 'superadmin':
      return buildAdminSummary(accessToken);
    case 'librarian':
      return buildLibrarianSummary(accessToken);
    default:
      return fallbackSummary(role);
  }
};

export const RoleDashboardScreen: React.FC = () => {
  const route = useRoute<DashboardRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const role = state.user?.role ?? route.params.role;
  const isControlCenterRole = role === 'admin' || role === 'superadmin';
  const userName = state.user?.display_name?.trim() || state.user?.username || roleLabels[role];
  const simpleMode = state.user?.prefers_simple_language !== false;

  const [summary, setSummary] = useState<RoleSummary>(fallbackSummary(role));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (isRefresh = false) => {
      if (isControlCenterRole) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
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
        const next = await buildRoleSummary(state.accessToken, role);
        setSummary(next);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load role workspace summary.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isControlCenterRole, role, state.accessToken],
  );

  useEffect(() => {
    if (isControlCenterRole) {
      navigation.replace(Platform.OS === 'web' ? 'AdminControlCenter' : 'WebOnlyAdminNotice');
      return;
    }
    loadSummary(false);
  }, [isControlCenterRole, loadSummary, navigation]);

  const modules = useMemo(() => {
    const items = featureCatalog[role];
    return simpleMode ? items.slice(0, 5) : items;
  }, [role, simpleMode]);
  const visibleMetrics = useMemo(
    () => (simpleMode ? summary.metrics.slice(0, 4) : summary.metrics),
    [simpleMode, summary.metrics],
  );
  const visibleHighlights = useMemo(
    () => (simpleMode ? summary.highlights.slice(0, 4) : summary.highlights),
    [simpleMode, summary.highlights],
  );

  const openFeature = (feature: FeatureDescriptor) => {
    if (role === 'lecturer' && feature.key === 'classes') {
      navigation.navigate('LecturerClasses');
      return;
    }
    if (role === 'lecturer' && feature.key === 'assignments') {
      navigation.navigate('LecturerAssignments');
      return;
    }
    if (
      role === 'lecturer' &&
      (feature.key === 'messages' || feature.key === 'communicate' || feature.key === 'comms')
    ) {
      navigation.navigate('MessageThreads', { role });
      return;
    }
    if ((role === 'records' || role === 'hod') && feature.key === 'records') {
      navigation.navigate('RecordsControlCenter');
      return;
    }
    if ((role === 'records' || role === 'hod') && feature.key === 'users') {
      navigation.navigate('RecordsControlCenter');
      return;
    }
    navigation.navigate('Feature', { role, feature });
  };

  const menuActions = useMemo(
    () => [
      ...(role === 'lecturer'
        ? [{ label: 'Message center', onPress: () => navigation.navigate('MessageThreads', { role }) }]
        : []),
      ...(role === 'records' || role === 'hod'
        ? [{ label: 'Control center', onPress: () => navigation.navigate('RecordsControlCenter') }]
        : []),
      { label: 'Refresh data', onPress: () => loadSummary(true) },
      { label: 'Log out', onPress: logout },
    ],
    [loadSummary, logout, navigation, role],
  );

  if (isControlCenterRole) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Opening admin control center...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading {roleLabels[role]} workspace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSummary(true)} />
        }
      >
        <GreetingHeader
          name={userName}
          greeting={`${roleLabels[role]} workspace`}
          rightAccessory={<RoleBadge role={role} />}
        />

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            {simpleMode
              ? 'Quick workspace view. Use the modules below for actions.'
              : summary.intro}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh all workspace data</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadSummary(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operational metrics</Text>
          <View style={styles.metricsCard}>
            {visibleMetrics.map((metric, index) => (
              <View key={`metric-${metric.label}-${index}`} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modules</Text>
          {modules.map((feature) => (
            <DashboardTile
              key={`${feature.key}-${feature.title}`}
              title={feature.title}
              subtitle={feature.description}
              onPress={() => openFeature(feature)}
            />
          ))}
        </View>

        {role === 'lecturer' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending notifications</Text>
            {visibleHighlights.map((item, index) => (
              <DashboardTile
                key={`${item.title}-${index}`}
                title={item.title}
                subtitle={item.subtitle}
                disabled
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <AppMenu
        actions={menuActions}
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
  introCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  introText: {
    ...typography.helper,
    color: palette.textSecondary,
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
    gap: spacing.md,
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
