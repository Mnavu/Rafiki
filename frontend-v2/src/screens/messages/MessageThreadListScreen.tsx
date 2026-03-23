import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AppMenu,
  DashboardTile,
  GreetingHeader,
  RoleBadge,
  VoiceButton,
} from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { Role } from '@app-types/roles';
import { roleLabels } from '@app-types/roles';
import {
  createStudentLecturerThread,
  fetchCommunicationThreads,
  fetchParentStudentLinks,
  fetchStudentAssignments,
  fetchStudentLecturers,
  fetchStudentProfile,
  type ApiUser,
  type CommunicationThread,
  type ParentStudentLink,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { formatThreadTitle } from './participantLabels';

type ThreadListRoute = RouteProp<RootStackParamList, 'MessageThreads'>;

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

const buildHistorySubtitle = (thread: CommunicationThread): string => {
  const messageCount = thread.messages.length;
  const lastMessage = [...thread.messages]
    .sort((left, right) => parseMillis(right.created_at) - parseMillis(left.created_at))
    .at(0);
  if (!lastMessage) {
    return `No messages yet  |  Updated ${formatDateTime(thread.updated_at)}`;
  }
  const body = (lastMessage.body || lastMessage.transcript || '').trim();
  const preview = body ? body.slice(0, 56) : 'Voice note';
  return `${preview}${body.length > 56 ? '...' : ''}  |  ${messageCount} messages`;
};

export const MessageThreadListScreen: React.FC = () => {
  const route = useRoute<ThreadListRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const role: Role = state.user?.role ?? route.params.role;
  const userName = state.user?.display_name?.trim() || state.user?.username || roleLabels[role];

  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [studentYearByUserId, setStudentYearByUserId] = useState<Record<number, number | null>>(
    {},
  );
  const [lecturerUnitTitle, setLecturerUnitTitle] = useState<string | null>(null);
  const [guardianLinks, setGuardianLinks] = useState<ParentStudentLink[]>([]);
  const [availableLecturers, setAvailableLecturers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingLecturerThreadId, setCreatingLecturerThreadId] = useState<number | null>(null);

  const loadThreads = useCallback(
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
        const [threadData, links, assignments, lecturers] = await Promise.all([
          fetchCommunicationThreads(accessToken),
          role === 'parent' ? fetchParentStudentLinks(accessToken).catch(() => []) : Promise.resolve([]),
          role === 'lecturer'
            ? fetchStudentAssignments(accessToken).catch(() => [])
            : Promise.resolve([]),
          role === 'student' ? fetchStudentLecturers(accessToken).catch(() => []) : Promise.resolve([]),
        ]);

        const sorted = [...threadData].sort(
          (left, right) => parseMillis(right.updated_at) - parseMillis(left.updated_at),
        );
        setThreads(sorted);
        setGuardianLinks(links);
        setLecturerUnitTitle(assignments[0]?.unit_title ?? null);
        setAvailableLecturers(lecturers);

        const studentIds = new Set<number>();
        sorted.forEach((thread) => {
          if (thread.student_detail?.id) {
            studentIds.add(thread.student_detail.id);
          } else if (thread.student) {
            studentIds.add(thread.student);
          }
        });
        links.forEach((link) => {
          studentIds.add(link.student);
        });

        const yearPairs = await Promise.all(
          [...studentIds].map(async (studentUserId) => {
            try {
              const profile = await fetchStudentProfile(accessToken, studentUserId);
              return [studentUserId, profile.year] as const;
            } catch {
              return [studentUserId, null] as const;
            }
          }),
        );
        setStudentYearByUserId(
          yearPairs.reduce<Record<number, number | null>>((acc, [studentUserId, year]) => {
            acc[studentUserId] = year;
            return acc;
          }, {}),
        );
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load communication channels.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role, state.accessToken],
  );

  useEffect(() => {
    loadThreads(false);
  }, [loadThreads]);

  const metrics = useMemo(() => {
    const totalMessages = threads.reduce((total, thread) => total + thread.messages.length, 0);
    const withVoice = threads.filter((thread) =>
      thread.messages.some((message) => !!message.audio),
    ).length;
    return [
      { label: 'Channels', value: String(threads.length) },
      { label: 'Messages', value: String(totalMessages) },
      { label: 'Voice-enabled', value: String(withVoice) },
    ];
  }, [threads]);

  const openThread = (thread: CommunicationThread) => {
    const title = formatThreadTitle(thread, role, {
      viewerUserId: state.user?.id,
      studentYearByUserId,
      lecturerUnitTitle,
    });
    navigation.navigate('MessageThreadDetail', {
      role,
      threadId: thread.id,
      threadTitle: title,
    });
  };

  const startStudentLecturerThread = useCallback(
    async (lecturerId: number) => {
      if (!state.accessToken || creatingLecturerThreadId) {
        return;
      }
      setCreatingLecturerThreadId(lecturerId);
      setError(null);
      try {
        const thread = await createStudentLecturerThread(state.accessToken, lecturerId);
        await loadThreads(true);
        const title = formatThreadTitle(thread, role, {
          viewerUserId: state.user?.id,
          studentYearByUserId,
          lecturerUnitTitle,
        });
        navigation.navigate('MessageThreadDetail', {
          role,
          threadId: thread.id,
          threadTitle: title,
        });
      } catch (threadError) {
        if (threadError instanceof Error) {
          setError(threadError.message);
        } else {
          setError('Unable to open lecturer channel.');
        }
      } finally {
        setCreatingLecturerThreadId(null);
      }
    },
    [
      creatingLecturerThreadId,
      lecturerUnitTitle,
      loadThreads,
      navigation,
      role,
      state.accessToken,
      state.user?.id,
      studentYearByUserId,
    ],
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading communication channels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadThreads(true)} />}
      >
        <GreetingHeader
          name={userName}
          greeting={`${roleLabels[role]} message center`}
          rightAccessory={<RoleBadge role={role} />}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication summary</Text>
          <View style={styles.metricsCard}>
            {metrics.map((item, index) => (
              <View key={`thread-metric-${item.label}-${index}`} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{item.label}</Text>
                <Text style={styles.metricValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh communication channels</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadThreads(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available channels</Text>
          {threads.length ? (
            threads.map((thread, index) => (
              <DashboardTile
                key={`thread-${thread.id}-${index}`}
                title={formatThreadTitle(thread, role, {
                  viewerUserId: state.user?.id,
                  studentYearByUserId,
                  lecturerUnitTitle,
                })}
                subtitle={`Updated ${formatDateTime(thread.updated_at)}  |  ${thread.messages.length} messages`}
                onPress={() => openThread(thread)}
              />
            ))
          ) : (
            <DashboardTile
              title="No communication channels"
              subtitle="Create or request a thread to start communication."
              disabled
            />
          )}
        </View>

        {role === 'student' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available lecturers</Text>
            {availableLecturers.length ? (
              availableLecturers.map((lecturer) => (
                <DashboardTile
                  key={`student-lecturer-${lecturer.id}`}
                  title={lecturer.display_name || lecturer.username}
                  subtitle="Tap to open or create a direct lecturer channel."
                  onPress={() => startStudentLecturerThread(lecturer.id)}
                  disabled={creatingLecturerThreadId === lecturer.id}
                />
              ))
            ) : (
              <DashboardTile
                title="No lecturer channels yet"
                subtitle="Lecturers appear here once your units are assigned and approved."
                disabled
              />
            )}
            <DashboardTile
              title="Need help? Open chatbot"
              subtitle="Ask quick academic and timetable questions while messaging."
              onPress={() => navigation.navigate('StudentChatbot')}
            />
            <DashboardTile
              title="Start private student chat"
              subtitle="Open peer directory and launch 1:1 thread with classmates sharing your approved units."
              onPress={() => navigation.navigate('StudentPeerDirectory')}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message history tracking</Text>
          {threads.length ? (
            threads.slice(0, 6).map((thread, index) => (
              <DashboardTile
                key={`history-${thread.id}-${index}`}
                title={formatThreadTitle(thread, role, {
                  viewerUserId: state.user?.id,
                  studentYearByUserId,
                  lecturerUnitTitle,
                })}
                subtitle={buildHistorySubtitle(thread)}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No message history yet"
              subtitle="Conversation activity appears here as channels are used."
              disabled
            />
          )}
        </View>

        {role === 'parent' && guardianLinks.length === 0 ? (
          <View style={styles.section}>
            <DashboardTile
              title="Guardian links missing"
              subtitle="Ask records/admin to link students to this Guardian account for full communication access."
              disabled
            />
          </View>
        ) : null}
      </ScrollView>

      <AppMenu
        actions={[
          ...(role === 'student'
            ? [{ label: 'Help chatbot', onPress: () => navigation.navigate('StudentChatbot') }]
            : []),
          ...(role === 'student'
            ? [{ label: 'Peer directory', onPress: () => navigation.navigate('StudentPeerDirectory') }]
            : []),
          { label: 'Refresh channels', onPress: () => loadThreads(true) },
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
