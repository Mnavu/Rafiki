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
  fetchCommunicationThreads,
  fetchFinancePayments,
  fetchParentStudentLinks,
  fetchStudentFinanceStatuses,
  fetchStudentProgressSummary,
  fetchStudentRewards,
  type CommunicationThread,
  type FinanceStatusSummary,
  type ParentStudentLink,
  type PaymentSummary,
  type StudentProgressSummary,
  type StudentRewardsSummary,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { roleLabels } from '@app-types/roles';

type ChildSnapshot = {
  link: ParentStudentLink;
  progress: StudentProgressSummary | null;
  rewards: StudentRewardsSummary | null;
  financeStatus: FinanceStatusSummary | null;
  recentPayment: PaymentSummary | null;
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
    return 'No timestamp';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No timestamp';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatMoney = (value: string): string => {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(numeric);
};

const buildChildSubtitle = (snapshot: ChildSnapshot): string => {
  const parts: string[] = [];
  if (snapshot.link.relationship) {
    parts.push(snapshot.link.relationship);
  }
  if (snapshot.progress) {
    parts.push(
      `Progress ${snapshot.progress.completed_units}/${snapshot.progress.total_units} units`,
    );
  }
  if (snapshot.rewards) {
    parts.push(`${snapshot.rewards.stars} stars`);
  }
  if (snapshot.financeStatus) {
    parts.push(
      `Fees ${formatMoney(snapshot.financeStatus.total_paid)} of ${formatMoney(snapshot.financeStatus.total_due)}`,
    );
  }
  if (!parts.length) {
    return 'No linked data available yet.';
  }
  return parts.join('  |  ');
};

export const ParentHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const [children, setChildren] = useState<ChildSnapshot[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParentData = useCallback(
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
        const accessToken = state.accessToken;
        const links = await fetchParentStudentLinks(accessToken);
        const [threadList, financeStatuses, payments, childSnapshots] = await Promise.all([
          fetchCommunicationThreads(accessToken).catch(() => []),
          fetchStudentFinanceStatuses(accessToken).catch(() => []),
          fetchFinancePayments(accessToken).catch(() => []),
          Promise.all(
            links.map(async (link) => {
              const [progress, rewards] = await Promise.all([
                fetchStudentProgressSummary(accessToken, link.student).catch(() => null),
                fetchStudentRewards(accessToken, link.student).catch(() => null),
              ]);
              return { link, progress, rewards };
            }),
          ),
        ]);

        const latestFinanceByStudent = financeStatuses.reduce<Record<number, FinanceStatusSummary>>(
          (acc, item) => {
            const studentId = item.student ?? 0;
            if (!studentId) {
              return acc;
            }
            const current = acc[studentId];
            if (!current) {
              acc[studentId] = item;
              return acc;
            }
            if (item.academic_year > current.academic_year) {
              acc[studentId] = item;
              return acc;
            }
            if (
              item.academic_year === current.academic_year &&
              item.trimester >= current.trimester
            ) {
              acc[studentId] = item;
            }
            return acc;
          },
          {},
        );
        const latestPaymentByStudent = payments.reduce<Record<number, PaymentSummary>>((acc, item) => {
          const studentId = item.student ?? 0;
          if (!studentId) {
            return acc;
          }
          const current = acc[studentId];
          const currentStamp = current ? parseMillis(current.paid_at || current.created_at) : 0;
          const nextStamp = parseMillis(item.paid_at || item.created_at);
          if (!current || nextStamp >= currentStamp) {
            acc[studentId] = item;
          }
          return acc;
        }, {});

        setThreads(threadList);
        setChildren(
          childSnapshots.map((snapshot) => ({
            ...snapshot,
            financeStatus: latestFinanceByStudent[snapshot.link.student] ?? null,
            recentPayment: latestPaymentByStudent[snapshot.link.student] ?? null,
          })),
        );
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load Guardian dashboard data.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadParentData(false);
  }, [loadParentData]);

  const parentName = useMemo(() => {
    return state.user?.display_name?.trim() || state.user?.username || roleLabels.parent;
  }, [state.user]);

  const threadSummary = useMemo(() => {
    const totalMessages = threads.reduce((total, thread) => total + thread.messages.length, 0);
    const sortedThreads = [...threads].sort((left, right) => {
      const leftStamp = parseMillis(left.updated_at);
      const rightStamp = parseMillis(right.updated_at);
      return rightStamp - leftStamp;
    });
    return {
      totalMessages,
      latest: sortedThreads.slice(0, 3),
    };
  }, [threads]);

  if (loading && !children.length) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.helper}>Loading Guardian workspace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadParentData(true)} />
        }
      >
        <GreetingHeader
          name={parentName}
          greeting="Guardian workspace"
          rightAccessory={<RoleBadge role="parent" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh all Guardian data</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadParentData(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Linked students</Text>
              <Text style={styles.metricValue}>{children.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Active threads</Text>
              <Text style={styles.metricValue}>{threads.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Messages available</Text>
              <Text style={styles.metricValue}>{threadSummary.totalMessages}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your students</Text>
          {children.length ? (
            children.map((snapshot, index) => (
              <DashboardTile
                key={`child-${snapshot.link.id}-${index}`}
                title={snapshot.link.student_detail.display_name || snapshot.link.student_detail.username}
                subtitle={buildChildSubtitle(snapshot)}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No linked students yet"
              subtitle="Ask records/admin to create a Guardian-student link for this account."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fees (linked students)</Text>
          {children.length ? (
            children.map((snapshot, index) => (
              <DashboardTile
                key={`fees-${snapshot.link.id}-${index}`}
                title={snapshot.link.student_detail.display_name || snapshot.link.student_detail.username}
                subtitle={
                  snapshot.financeStatus
                    ? `Paid ${formatMoney(snapshot.financeStatus.total_paid)} of ${formatMoney(snapshot.financeStatus.total_due)} | ${snapshot.financeStatus.clearance_status}`
                    : 'No finance status record yet.'
                }
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No linked students yet"
              subtitle="Link at least one student account to mirror fee progress."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent messages</Text>
          {threadSummary.latest.length ? (
            threadSummary.latest.map((thread, index) => (
              <DashboardTile
                key={`parent-thread-${thread.id}-${index}`}
                title={thread.subject || `Thread #${thread.id}`}
                subtitle={`Updated ${formatDateTime(thread.updated_at)}  |  ${thread.messages.length} messages`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No conversation threads yet"
              subtitle="Thread activity with lecturers will appear here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          <DashboardTile
            title="Guardian message center"
            subtitle="Open channels with lecturers and track the full conversation history."
            onPress={() => navigation.navigate('MessageThreads', { role: 'parent' })}
          />
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          {
            label: 'Message center',
            onPress: () => navigation.navigate('MessageThreads', { role: 'parent' }),
          },
          { label: 'Refresh data', onPress: () => loadParentData(true) },
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
