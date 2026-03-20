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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { FeatureDescriptor, FeatureKey } from '@data/featureCatalog';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchAdminAnalytics,
  fetchAdminPipelineStudents,
  fetchCommunicationThreads,
  fetchDepartments,
  fetchDepartmentLecturers,
  fetchDepartmentProgrammes,
  fetchDepartmentStudents,
  fetchFinancePayments,
  fetchHodPendingApprovals,
  fetchLecturerGradingQueue,
  fetchLibraryAssets,
  fetchNotifications,
  fetchParentStudentLinks,
  fetchProgrammes,
  fetchProvisionRequests,
  fetchQuizzes,
  fetchStudentAssignments,
  fetchStudentFinanceStatuses,
  fetchStudentProgressSummary,
  fetchStudentRegistrations,
  fetchStudentTimetable,
  fetchUsers,
  type ApiUser,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type FeatureRoute = RouteProp<RootStackParamList, 'Feature'>;
type FeatureNav = NativeStackNavigationProp<RootStackParamList>;

type FeatureMetric = {
  label: string;
  value: string;
};

type FeatureTile = {
  title: string;
  subtitle: string;
};

type FeatureSnapshot = {
  summary: string;
  metrics: FeatureMetric[];
  items: FeatureTile[];
};

type FeatureSnapshotParams = {
  accessToken: string;
  user: ApiUser | null;
  role: RootStackParamList['Feature']['role'];
  feature: FeatureDescriptor;
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

const buildFallbackSnapshot = (feature: FeatureDescriptor): FeatureSnapshot => ({
  summary: `The ${feature.title} workspace is ready. Connect data sources for live operational views.`,
  metrics: [
    { label: 'Module', value: feature.title },
    { label: 'Status', value: 'Configured' },
  ],
  items: [
    {
      title: 'Module ready',
      subtitle: 'This feature is structured and can now be expanded with deeper workflows.',
    },
  ],
});

const buildTimetableSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const entries = await safeCall(() => fetchStudentTimetable(accessToken), []);
  const upcoming = [...entries]
    .sort((left, right) => parseMillis(left.start_datetime) - parseMillis(right.start_datetime))
    .slice(0, 8);

  return {
    summary: `${entries.length} timetable entries are available in this workspace.`,
    metrics: [
      { label: 'Total entries', value: String(entries.length) },
      { label: 'Upcoming shown', value: String(upcoming.length) },
    ],
    items:
      upcoming.length > 0
        ? upcoming.map((entry) => ({
            title: `Unit #${entry.unit ?? 'N/A'} in ${entry.room}`,
            subtitle: `${formatDateTime(entry.start_datetime)} to ${formatDateTime(entry.end_datetime)}`,
          }))
        : [
            {
              title: 'No timetable entries',
              subtitle: 'Timetable data will appear here once schedules are published.',
            },
          ],
  };
};

const buildAssignmentsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const assignments = await safeCall(() => fetchStudentAssignments(accessToken), []);
  const dueSoon = [...assignments]
    .sort((left, right) => parseMillis(left.due_at) - parseMillis(right.due_at))
    .slice(0, 8);

  return {
    summary: `${assignments.length} assignments are currently visible.`,
    metrics: [
      { label: 'Assignments', value: String(assignments.length) },
      {
        label: 'Due soon',
        value: String(dueSoon.filter((item) => parseMillis(item.due_at) > 0).length),
      },
    ],
    items:
      dueSoon.length > 0
        ? dueSoon.map((item) => ({
            title: item.title,
            subtitle: `${item.unit_title}  |  Due ${formatDateTime(item.due_at)}`,
          }))
        : [
            {
              title: 'No assignments found',
              subtitle: 'Assignments will appear after they are posted to this role scope.',
            },
          ],
  };
};

const buildThreadsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const threads = await safeCall(() => fetchCommunicationThreads(accessToken), []);
  const totalMessages = threads.reduce((total, thread) => total + thread.messages.length, 0);
  const recentThreads = [...threads]
    .sort((left, right) => parseMillis(right.updated_at) - parseMillis(left.updated_at))
    .slice(0, 8);

  return {
    summary: `${threads.length} communication threads with ${totalMessages} total messages.`,
    metrics: [
      { label: 'Threads', value: String(threads.length) },
      { label: 'Messages', value: String(totalMessages) },
    ],
    items:
      recentThreads.length > 0
        ? recentThreads.map((thread) => ({
            title: thread.subject || `Thread #${thread.id}`,
            subtitle: `Updated ${formatDateTime(thread.updated_at)}  |  ${thread.messages.length} messages`,
          }))
        : [
            {
              title: 'No communication threads',
              subtitle: 'Threads will appear once users start new conversations.',
            },
          ],
  };
};

const buildNotificationsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const notifications = await safeCall(() => fetchNotifications(accessToken), []);
  const queued = notifications.filter((item) => item.status === 'queued').length;
  const sent = notifications.filter((item) => item.status === 'sent').length;
  const recent = [...notifications]
    .sort((left, right) => parseMillis(right.send_at) - parseMillis(left.send_at))
    .slice(0, 8);

  return {
    summary: `${notifications.length} notifications are available for this account scope.`,
    metrics: [
      { label: 'Notifications', value: String(notifications.length) },
      { label: 'Queued', value: String(queued) },
      { label: 'Sent', value: String(sent) },
    ],
    items:
      recent.length > 0
        ? recent.map((note) => ({
            title: `${note.type} (${note.channel})`,
            subtitle: `${note.status.toUpperCase()}  |  ${formatDateTime(note.send_at)}`,
          }))
        : [
            {
              title: 'No notifications',
              subtitle: 'Scheduled notices and alerts will appear here.',
            },
          ],
  };
};

const buildLibrarySnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const assets = await safeCall(() => fetchLibraryAssets(accessToken), []);
  const byType = assets.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.type] = (acc[asset.type] ?? 0) + 1;
    return acc;
  }, {});
  const top = assets.slice(0, 8);

  return {
    summary: `${assets.length} library assets are currently discoverable.`,
    metrics: [
      { label: 'Assets', value: String(assets.length) },
      { label: 'PDF', value: String(byType.pdf ?? 0) },
      { label: 'Video', value: String(byType.video ?? 0) },
    ],
    items:
      top.length > 0
        ? top.map((asset) => ({
            title: asset.title,
            subtitle: `${asset.type.toUpperCase()}  |  ${asset.visibility} scope`,
          }))
        : [
            {
              title: 'No library assets',
              subtitle: 'Repository resources will show once uploaded.',
            },
          ],
  };
};

const buildProgressSnapshot = async (
  accessToken: string,
  user: ApiUser | null,
  role: FeatureSnapshotParams['role'],
): Promise<FeatureSnapshot> => {
  if (role === 'parent') {
    const links = await safeCall(() => fetchParentStudentLinks(accessToken), []);
    const progress = await Promise.all(
      links.map((link) =>
        safeCall(
          () =>
            fetchStudentProgressSummary(accessToken, link.student).then((item) => ({
              link,
              item,
            })),
          null,
        ),
      ),
    );
    const validProgress = progress.filter((item): item is NonNullable<typeof item> => !!item);
    return {
      summary: `${validProgress.length} linked student progress cards are available.`,
      metrics: [
        { label: 'Linked students', value: String(links.length) },
        { label: 'Progress cards', value: String(validProgress.length) },
      ],
      items:
        validProgress.length > 0
          ? validProgress.map(({ link, item }) => ({
              title: link.student_detail.display_name || link.student_detail.username,
              subtitle: `Completed ${item.completed_units}/${item.total_units} units`,
            }))
          : [
              {
                title: 'No progress cards',
                subtitle: 'Create Guardian-student links to view progress snapshots.',
              },
            ],
    };
  }

  const registrations = await safeCall(() => fetchStudentRegistrations(accessToken), []);
  const approved = registrations.filter((item) => item.status === 'approved').length;
  const pending = registrations.filter((item) => item.status === 'pending_hod').length;

  if (role === 'student' && user) {
    const summary = await safeCall(() => fetchStudentProgressSummary(accessToken, user.id), null);
    if (summary) {
      return {
        summary: `${summary.completed_units} of ${summary.total_units} units completed.`,
        metrics: [
          { label: 'Completed units', value: String(summary.completed_units) },
          { label: 'Total units', value: String(summary.total_units) },
        ],
        items:
          summary.programmes.length > 0
            ? summary.programmes.map((programme) => ({
                title: `${programme.programme_code} - ${programme.programme_name}`,
                subtitle: `${programme.unit_progress.length} tracked units`,
              }))
            : [
                {
                  title: 'No programme summaries',
                  subtitle: 'Programme progress appears after approved registrations.',
                },
              ],
      };
    }
  }

  return {
    summary: `${registrations.length} registrations available for progress tracking.`,
    metrics: [
      { label: 'Registrations', value: String(registrations.length) },
      { label: 'Approved', value: String(approved) },
      { label: 'Pending', value: String(pending) },
    ],
    items:
      registrations.length > 0
        ? registrations.slice(0, 8).map((item) => ({
            title: item.unit_title,
            subtitle: `${item.status.replaceAll('_', ' ')}  |  Y${item.academic_year} T${item.trimester}`,
          }))
        : [
            {
              title: 'No registration data',
              subtitle: 'Progress reporting starts once registration records exist.',
            },
          ],
  };
};

const buildFeesSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const [statuses, payments] = await Promise.all([
    safeCall(() => fetchStudentFinanceStatuses(accessToken), []),
    safeCall(() => fetchFinancePayments(accessToken), []),
  ]);
  const blocked = statuses.filter((item) => item.clearance_status === 'blocked').length;
  const recentPayments = [...payments]
    .sort((left, right) => parseMillis(right.created_at) - parseMillis(left.created_at))
    .slice(0, 6);
  const topStatus = [...statuses]
    .sort((left, right) => {
      if (left.academic_year !== right.academic_year) {
        return right.academic_year - left.academic_year;
      }
      return right.trimester - left.trimester;
    })
    .slice(0, 4)
    .map((item) => ({
      title: `Status Y${item.academic_year} T${item.trimester}`,
      subtitle: `${item.status}  |  Paid ${formatCurrency(item.total_paid)} / ${formatCurrency(item.total_due)}`,
    }));

  return {
    summary: `${statuses.length} finance status records and ${payments.length} payments are visible.`,
    metrics: [
      { label: 'Status records', value: String(statuses.length) },
      { label: 'Payments', value: String(payments.length) },
      { label: 'Blocked', value: String(blocked) },
    ],
    items:
      [...topStatus, ...recentPayments.map((payment) => ({
        title: `Payment ${formatCurrency(payment.amount)}`,
        subtitle: `Y${payment.academic_year} T${payment.trimester}  |  ${payment.method || 'Unknown method'}`,
      }))].slice(0, 8) || [],
  };
};

const buildRecordsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const [registrations, gradingQueue] = await Promise.all([
    safeCall(() => fetchStudentRegistrations(accessToken), []),
    safeCall(() => fetchLecturerGradingQueue(accessToken), []),
  ]);
  const pending = registrations.filter((item) => item.status === 'pending_hod').length;
  const ungraded = gradingQueue.filter((item) => item.grade === null || item.grade === '').length;

  return {
    summary: `${registrations.length} registrations and ${gradingQueue.length} submissions in scope.`,
    metrics: [
      { label: 'Registrations', value: String(registrations.length) },
      { label: 'Pending HOD', value: String(pending) },
      { label: 'Ungraded', value: String(ungraded) },
    ],
    items:
      registrations.length > 0
        ? registrations.slice(0, 8).map((item) => ({
            title: item.unit_title,
            subtitle: `${item.status.replaceAll('_', ' ')}  |  ${item.student_name || 'Student unavailable'}`,
          }))
        : [
            {
              title: 'No record items',
              subtitle: 'Registration and grading records will appear here.',
            },
          ],
  };
};

const buildUsersSnapshot = async (
  accessToken: string,
  role: FeatureSnapshotParams['role'],
): Promise<FeatureSnapshot> => {
  const [users, requests, departments] = await Promise.all([
    safeCall(() => fetchUsers(accessToken), []),
    safeCall(() => fetchProvisionRequests(accessToken), []),
    safeCall(() => fetchDepartments(accessToken), []),
  ]);
  const pending = requests.filter((item) => item.status === 'pending');

  const deptCards = (
    await Promise.all(
      departments.slice(0, 3).map(async (department) => {
        const [lecturers, programmes] = await Promise.all([
          safeCall(() => fetchDepartmentLecturers(accessToken, department.id), []),
          safeCall(() => fetchDepartmentProgrammes(accessToken, department.id), []),
        ]);
        return {
          title: department.name,
          subtitle: `${lecturers.length} lecturers  |  ${programmes.length} programmes`,
        };
      }),
    )
  ).slice(0, 3);

  const baseItems =
    pending.length > 0
      ? pending.slice(0, 5).map((item) => ({
          title: `${item.username} (${item.role})`,
          subtitle: `Pending since ${formatDateTime(item.created_at)}`,
        }))
      : users.slice(0, 5).map((item) => ({
          title: item.display_name || item.username,
          subtitle: `${item.role}  |  ${item.email || 'No email'}`,
        }));

  return {
    summary: `${users.length} users and ${requests.length} provisioning requests are visible.`,
    metrics: [
      { label: 'Users', value: String(users.length) },
      { label: 'Pending requests', value: String(pending.length) },
      { label: 'Departments', value: String(departments.length) },
    ],
    items:
      role === 'hod' && deptCards.length > 0
        ? [...deptCards, ...baseItems].slice(0, 8)
        : baseItems.length > 0
          ? baseItems
          : [
              {
                title: 'No user data available',
                subtitle: 'Verify role permissions if this module should display users.',
              },
            ],
  };
};

const buildAnalyticsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const [analytics, assets, pipeline] = await Promise.all([
    safeCall(() => fetchAdminAnalytics(accessToken), null),
    safeCall(() => fetchLibraryAssets(accessToken), []),
    safeCall(() => fetchAdminPipelineStudents(accessToken), []),
  ]);

  if (analytics) {
    return {
      summary: 'Analytics KPIs loaded from admin telemetry endpoints.',
      metrics: [
        { label: 'Weekly logins', value: String(analytics.weekly_logins) },
        { label: 'Chatbot questions', value: String(analytics.chatbot_questions) },
        { label: 'Alerts sent', value: String(analytics.alerts_sent) },
      ],
      items: [
        {
          title: 'Identity traffic',
          subtitle: `${analytics.weekly_logins} logins in the last 7 days.`,
        },
        {
          title: 'Support engagement',
          subtitle: `${analytics.chatbot_questions} support questions captured.`,
        },
        {
          title: 'Notification delivery',
          subtitle: `${analytics.alerts_sent} alerts marked as sent.`,
        },
      ],
    };
  }

  return {
    summary: 'Analytics fallback view built from accessible operational datasets.',
    metrics: [
      { label: 'Pipeline students', value: String(pipeline.length) },
      { label: 'Library assets', value: String(assets.length) },
    ],
    items: [
      {
        title: 'Pipeline visibility',
        subtitle: `${pipeline.length} students currently visible in the admin pipeline.`,
      },
      {
        title: 'Repository visibility',
        subtitle: `${assets.length} assets discovered through repository APIs.`,
      },
    ],
  };
};

const buildPerformanceSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const [pendingApprovals, statuses, quizzes] = await Promise.all([
    safeCall(() => fetchHodPendingApprovals(accessToken), []),
    safeCall(() => fetchStudentFinanceStatuses(accessToken), []),
    safeCall(() => fetchQuizzes(accessToken), []),
  ]);
  const blockedFinance = statuses.filter((item) => item.clearance_status === 'blocked').length;

  return {
    summary: 'Performance combines approvals, finance readiness, and quiz activity.',
    metrics: [
      { label: 'Pending approvals', value: String(pendingApprovals.length) },
      { label: 'Blocked finance', value: String(blockedFinance) },
      { label: 'Quizzes', value: String(quizzes.length) },
    ],
    items:
      pendingApprovals.length > 0
        ? pendingApprovals.slice(0, 8).map((item) => ({
            title: item.unit_title,
            subtitle: `${item.student_name || 'Student unavailable'}  |  ${item.status.replaceAll('_', ' ')}`,
          }))
        : [
            {
              title: 'No pending approvals',
              subtitle: 'Approval and performance bottlenecks will appear here.',
            },
          ],
  };
};

const buildReportsSnapshot = async (accessToken: string): Promise<FeatureSnapshot> => {
  const [assignments, registrations, statuses, programmes, departments] = await Promise.all([
    safeCall(() => fetchStudentAssignments(accessToken), []),
    safeCall(() => fetchStudentRegistrations(accessToken), []),
    safeCall(() => fetchStudentFinanceStatuses(accessToken), []),
    safeCall(() => fetchProgrammes(accessToken), []),
    safeCall(() => fetchDepartments(accessToken), []),
  ]);
  const approved = registrations.filter((item) => item.status === 'approved').length;

  return {
    summary: 'Reporting roll-up generated from learning, finance, and structure data.',
    metrics: [
      { label: 'Programmes', value: String(programmes.length) },
      { label: 'Departments', value: String(departments.length) },
      { label: 'Assignments', value: String(assignments.length) },
      { label: 'Approved registrations', value: String(approved) },
      { label: 'Finance status rows', value: String(statuses.length) },
    ],
    items: [
      {
        title: 'Learning coverage',
        subtitle: `${assignments.length} assignments and ${registrations.length} registrations tracked.`,
      },
      {
        title: 'Structure coverage',
        subtitle: `${departments.length} departments mapped to ${programmes.length} programmes.`,
      },
      {
        title: 'Finance coverage',
        subtitle: `${statuses.length} finance status rows available for reporting.`,
      },
    ],
  };
};

const buildFeatureSnapshot = async ({
  accessToken,
  user,
  role,
  feature,
}: FeatureSnapshotParams): Promise<FeatureSnapshot> => {
  const key = feature.key as FeatureKey;
  switch (key) {
    case 'timetable':
    case 'classes':
      return buildTimetableSnapshot(accessToken);
    case 'assignments':
      return buildAssignmentsSnapshot(accessToken);
    case 'communicate':
    case 'messages':
    case 'comms':
      return buildThreadsSnapshot(accessToken);
    case 'help':
    case 'alerts':
    case 'announcements':
      return buildNotificationsSnapshot(accessToken);
    case 'library':
      return buildLibrarySnapshot(accessToken);
    case 'progress':
      return buildProgressSnapshot(accessToken, user, role);
    case 'fees':
      return buildFeesSnapshot(accessToken);
    case 'records':
      return buildRecordsSnapshot(accessToken);
    case 'users':
      return buildUsersSnapshot(accessToken, role);
    case 'analytics':
      return buildAnalyticsSnapshot(accessToken);
    case 'performance':
      return buildPerformanceSnapshot(accessToken);
    case 'reports':
    case 'reports_generation':
    case 'reports_semester':
    case 'reports_transcripts':
    case 'reports_overview':
      return buildReportsSnapshot(accessToken);
    case 'settings': {
      const [departments, notifications] = await Promise.all([
        safeCall(() => fetchDepartments(accessToken), []),
        safeCall(() => fetchNotifications(accessToken), []),
      ]);
      return {
        summary: 'Settings readiness view loaded from structure and notification controls.',
        metrics: [
          { label: 'Departments', value: String(departments.length) },
          { label: 'Notifications', value: String(notifications.length) },
        ],
        items: departments.length
          ? departments.slice(0, 8).map((department) => ({
              title: department.name,
              subtitle: `${department.code}  |  Configuration scope`,
            }))
          : [
              {
                title: 'No department scope loaded',
                subtitle: 'Use this area to align system and module defaults.',
              },
            ],
      };
    }
    case 'audit_policies': {
      const [requests, users, departments] = await Promise.all([
        safeCall(() => fetchProvisionRequests(accessToken), []),
        safeCall(() => fetchUsers(accessToken), []),
        safeCall(() => fetchDepartments(accessToken), []),
      ]);
      const pending = requests.filter((item) => item.status === 'pending').length;
      return {
        summary: 'Audit visibility centered on access approvals and role governance.',
        metrics: [
          { label: 'Pending approvals', value: String(pending) },
          { label: 'Users in scope', value: String(users.length) },
          { label: 'Departments', value: String(departments.length) },
        ],
        items:
          requests.length > 0
            ? requests.slice(0, 8).map((item) => ({
                title: `${item.username} (${item.role})`,
                subtitle: `${item.status.toUpperCase()}  |  Requested ${formatDateTime(item.created_at)}`,
              }))
            : [
                {
                  title: 'No provisioning audits',
                  subtitle: 'Approval events will appear here for policy review.',
                },
              ],
      };
    }
    default:
      return buildFallbackSnapshot(feature);
  }
};

export const RoleFeatureScreen: React.FC = () => {
  const route = useRoute<FeatureRoute>();
  const navigation = useNavigation<FeatureNav>();
  const { state, logout, updatePreferences } = useAuth();

  const role = route.params.role;
  const feature = route.params.feature;
  const isControlCenterRole = role === 'admin' || role === 'superadmin';
  const isLecturerAssignmentsRoute = role === 'lecturer' && feature.key === 'assignments';
  const userName =
    state.user?.display_name?.trim() || state.user?.username || route.params.role.toUpperCase();

  const [snapshot, setSnapshot] = useState<FeatureSnapshot>(buildFallbackSnapshot(feature));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeatureData = useCallback(
    async (isRefresh = false) => {
      if (isControlCenterRole || isLecturerAssignmentsRoute) {
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
        const data = await buildFeatureSnapshot({
          accessToken: state.accessToken,
          user: state.user,
          role,
          feature,
        });
        setSnapshot(data);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load feature data.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [feature, isControlCenterRole, isLecturerAssignmentsRoute, role, state.accessToken, state.user],
  );

  useEffect(() => {
    if (isControlCenterRole) {
      navigation.navigate(Platform.OS === 'web' ? 'AdminControlCenter' : 'WebOnlyAdminNotice');
      return;
    }
    if (isLecturerAssignmentsRoute) {
      navigation.navigate('LecturerAssignments');
      return;
    }
    loadFeatureData(false);
  }, [isControlCenterRole, isLecturerAssignmentsRoute, loadFeatureData, navigation]);

  const metricRows = useMemo(() => snapshot.metrics.slice(0, 6), [snapshot.metrics]);

  if (isControlCenterRole || isLecturerAssignmentsRoute) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>
          {isLecturerAssignmentsRoute ? 'Opening lecturer assignments workspace...' : 'Opening admin control center...'}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading {feature.title} workspace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFeatureData(true)} />
        }
      >
        <GreetingHeader
          name={userName}
          greeting={feature.title}
          rightAccessory={<RoleBadge role={role} />}
        />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{feature.title}</Text>
          <Text style={styles.summaryBody}>{feature.description}</Text>
          <Text style={styles.summaryBody}>{snapshot.summary}</Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh feature data</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadFeatureData(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live metrics</Text>
          <View style={styles.metricsCard}>
            {metricRows.map((metric, index) => (
              <View key={`feature-metric-${metric.label}-${index}`} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current data</Text>
          {snapshot.items.map((item, index) => (
            <DashboardTile
              key={`${item.title}-${index}`}
              title={item.title}
              subtitle={item.subtitle}
              disabled
            />
          ))}
        </View>

        {role === 'lecturer' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lecturer pending notifications</Text>
            {snapshot.items.length ? (
              snapshot.items.slice(0, 5).map((item, index) => (
                <DashboardTile
                  key={`lecturer-pending-${index}`}
                  title={item.title}
                  subtitle={item.subtitle}
                  disabled
                />
              ))
            ) : (
              <DashboardTile
                title="No pending lecturer notifications"
                subtitle="New grading and class workflow actions will appear here."
                disabled
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Back to modules', onPress: () => navigation.goBack() },
          { label: 'Refresh data', onPress: () => loadFeatureData(true) },
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
  summaryCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  summaryBody: {
    ...typography.helper,
    color: palette.textSecondary,
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
  guideCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  guideLine: {
    ...typography.helper,
    color: palette.textSecondary,
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
