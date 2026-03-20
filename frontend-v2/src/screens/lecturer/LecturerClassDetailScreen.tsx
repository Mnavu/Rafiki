import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchClassCalls,
  fetchClassCommunities,
  fetchLecturerClassDetail,
  scheduleClassCall,
  type ClassCallSummary,
  type ClassCommunitySummary,
  type LecturerClassDetail,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type LecturerClassDetailRoute = RouteProp<RootStackParamList, 'LecturerClassDetail'>;

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

const toIsoInput = (offsetHours: number): string => {
  const target = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}:00Z`;
};

export const LecturerClassDetailScreen: React.FC = () => {
  const route = useRoute<LecturerClassDetailRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const unitId = route.params.unitId;

  const [detail, setDetail] = useState<LecturerClassDetail | null>(null);
  const [calls, setCalls] = useState<ClassCallSummary[]>([]);
  const [community, setCommunity] = useState<ClassCommunitySummary | null>(null);
  const [title, setTitle] = useState('Online class session');
  const [description, setDescription] = useState('Scheduled lecturer-led online class.');
  const [startAt, setStartAt] = useState(toIsoInput(24));
  const [endAt, setEndAt] = useState(toIsoInput(25));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDetail = useCallback(
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
        const [classDetail, classCalls, communities] = await Promise.all([
          fetchLecturerClassDetail(state.accessToken, unitId),
          fetchClassCalls(state.accessToken, 'upcoming').catch(() => []),
          fetchClassCommunities(state.accessToken).catch(() => []),
        ]);
        setDetail(classDetail);
        setCalls(classCalls.filter((call) => call.unit_id === unitId));
        setCommunity(communities.find((item) => item.unit_id === unitId) ?? null);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load class detail.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken, unitId],
  );

  useEffect(() => {
    loadDetail(false);
  }, [loadDetail]);

  const classTitle = useMemo(() => {
    if (detail) {
      return `${detail.class.unit_code} - ${detail.class.unit_title}`;
    }
    return route.params.unitTitle || `Class #${unitId}`;
  }, [detail, route.params.unitTitle, unitId]);

  const latestCall = useMemo(() => calls[0] ?? null, [calls]);

  const scheduleCall = async () => {
    if (!state.accessToken) {
      return;
    }
    setScheduling(true);
    setSuccess(null);
    setError(null);
    try {
      const response = await scheduleClassCall(state.accessToken, {
        unit_id: unitId,
        title,
        description,
        start_at: startAt,
        end_at: endAt,
        include_guardians: true,
      });
      setSuccess(
        `${response.detail} Participants: ${response.participant_count}. Meeting: ${response.meeting_url}`,
      );
      await loadDetail(true);
    } catch (scheduleError) {
      if (scheduleError instanceof Error) {
        setError(scheduleError.message);
      } else {
        setError('Unable to schedule class call.');
      }
    } finally {
      setScheduling(false);
    }
  };

  if (loading && !detail) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading class detail...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDetail(true)} />}
      >
        <GreetingHeader
          name={classTitle}
          greeting="Class detail"
          rightAccessory={<RoleBadge role="lecturer" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Class detail error</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadDetail(true)} />
          </View>
        ) : null}

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Call scheduled</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course notifications (auto-clearing)</Text>
          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Notes/assessments to issue</Text>
              <Text style={styles.metricValue}>
                {detail?.pending.notes_or_assessments_to_issue ?? 0}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Submissions to mark</Text>
              <Text style={styles.metricValue}>{detail?.pending.submissions_to_mark ?? 0}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Messages awaiting response</Text>
              <Text style={styles.metricValue}>{detail?.pending.messages_waiting_response ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students and Guardians</Text>
          {detail?.students.length ? (
            detail.students.map((student, index) => (
              <DashboardTile
                key={`class-student-${student.student_user_id}-${index}`}
                title={`${student.student_name} - Student Year ${student.year}`}
                subtitle={`${student.guardians.map((g) => g.guardian_name).join(', ') || 'No guardian linked'}  |  Done ${student.assessment_summary.done}/${student.assessment_summary.total}  |  Missed ${student.assessment_summary.missed}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No approved students in this class"
              subtitle="Students appear after registration approval."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment performance tracker</Text>
          {detail?.students.length ? (
            detail.students.flatMap((student) =>
              student.assessments.slice(0, 4).map((assessment) => (
                <DashboardTile
                  key={`${student.student_user_id}-${assessment.assignment_id}`}
                  title={`${student.student_name} | ${assessment.assignment_title}`}
                  subtitle={`${assessment.assessment_type.toUpperCase()} (${assessment.assessment_mode})  |  ${assessment.status}  |  Grade ${assessment.grade ?? 'N/A'}`}
                  disabled
                />
              )),
            )
          ) : (
            <DashboardTile
              title="No assessment records yet"
              subtitle="Assessment status appears as submissions and grading happen."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule class call</Text>
          <View style={styles.composeCard}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Call title"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              placeholder="Description"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={startAt}
              onChangeText={setStartAt}
              style={styles.input}
              placeholder="Start (ISO datetime)"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={endAt}
              onChangeText={setEndAt}
              style={styles.input}
              placeholder="End (ISO datetime)"
              placeholderTextColor={palette.textSecondary}
            />
            <VoiceButton
              label={scheduling ? 'Scheduling...' : 'Schedule call and notify class'}
              onPress={scheduleCall}
            />
            {latestCall?.meeting_url ? (
              <VoiceButton
                label="Join latest room in-app"
                onPress={() =>
                  navigation.navigate('VideoRoom', {
                    meetingUrl: latestCall.meeting_url,
                    title: `${detail?.class.unit_code ?? ''} live room`,
                  })
                }
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Class community</Text>
          {community ? (
            <DashboardTile
              title={`${community.unit_code} group chat`}
              subtitle={`${community.students_count} students and ${community.lecturers_count} lecturers. Open shared thread.`}
              onPress={() =>
                navigation.navigate('ClassCommunityDetail', {
                  chatroomId: community.chatroom_id,
                  unitTitle: `${community.unit_code} - ${community.unit_title}`,
                  meetingUrl:
                    community.upcoming_call?.meeting_url || latestCall?.meeting_url || undefined,
                })
              }
            />
          ) : (
            <DashboardTile
              title="Class group not ready yet"
              subtitle="Once there are registered students, the class community will appear here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled calls for this class</Text>
          {calls.length ? (
            calls.map((call, index) => (
              <DashboardTile
                key={`class-call-${call.id}-${index}`}
                title={call.title}
                subtitle={`${formatDateTime(call.start_at)}  |  ${call.meeting_url}`}
                onPress={() =>
                  navigation.navigate('VideoRoom', {
                    meetingUrl: call.meeting_url,
                    title: `${call.unit_code} - ${call.title}`,
                  })
                }
              />
            ))
          ) : (
            <DashboardTile
              title="No scheduled calls for this class"
              subtitle="Use the scheduler above to create one."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Assignments workspace', onPress: () => navigation.navigate('LecturerAssignments') },
          {
            label: 'Weekly planner',
            onPress: () =>
              navigation.navigate('LecturerPlanner', {
                unitId,
                unitTitle: classTitle,
              }),
          },
          { label: 'Refresh class', onPress: () => loadDetail(true) },
          { label: 'Back to classes', onPress: () => navigation.goBack() },
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
  composeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    padding: spacing.md,
    color: palette.textPrimary,
    backgroundColor: palette.background,
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
  successCard: {
    backgroundColor: '#E3F9E5',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  successTitle: {
    ...typography.headingM,
    color: '#146C2E',
  },
  successBody: {
    ...typography.helper,
    color: '#146C2E',
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
