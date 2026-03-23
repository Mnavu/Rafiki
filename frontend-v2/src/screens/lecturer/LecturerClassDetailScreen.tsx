import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchClassCalls,
  fetchClassCommunities,
  fetchLecturerClassDetail,
  fetchLecturerGradingQueue,
  gradeLecturerSubmission,
  scheduleClassCall,
  type ClassCallSummary,
  type ClassCommunitySummary,
  type LecturerClassDetail,
  type SubmissionSummary,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type LecturerClassDetailRoute = RouteProp<RootStackParamList, 'LecturerClassDetail'>;

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No timestamp';
  }
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
  const [gradingQueue, setGradingQueue] = useState<SubmissionSummary[]>([]);
  const [gradeDrafts, setGradeDrafts] = useState<Record<number, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [title, setTitle] = useState('Online class session');
  const [description, setDescription] = useState('Scheduled lecturer-led online class.');
  const [startAt, setStartAt] = useState(toIsoInput(24));
  const [endAt, setEndAt] = useState(toIsoInput(25));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [savingSubmissionId, setSavingSubmissionId] = useState<number | null>(null);
  const [playingSubmissionId, setPlayingSubmissionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const cleanupPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore cleanup failure.
      }
      soundRef.current = null;
    }
    setPlayingSubmissionId(null);
  }, []);

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
        const [classDetail, classCalls, communities, lecturerSubmissions] = await Promise.all([
          fetchLecturerClassDetail(state.accessToken, unitId),
          fetchClassCalls(state.accessToken, 'upcoming').catch(() => []),
          fetchClassCommunities(state.accessToken).catch(() => []),
          fetchLecturerGradingQueue(state.accessToken).catch(() => []),
        ]);
        const scopedSubmissions = lecturerSubmissions
          .filter((item) => item.unit_id === unitId)
          .sort(
            (left, right) =>
              new Date(right.submitted_at || right.updated_at).getTime() -
              new Date(left.submitted_at || left.updated_at).getTime(),
          );
        setDetail(classDetail);
        setCalls(classCalls.filter((call) => call.unit_id === unitId));
        setCommunity(communities.find((item) => item.unit_id === unitId) ?? null);
        setGradingQueue(scopedSubmissions);
        setGradeDrafts((current) =>
          scopedSubmissions.reduce<Record<number, string>>((acc, item) => {
            acc[item.id] =
              current[item.id] ?? (item.grade !== null && item.grade !== undefined ? String(item.grade) : '');
            return acc;
          }, {}),
        );
        setFeedbackDrafts((current) =>
          scopedSubmissions.reduce<Record<number, string>>((acc, item) => {
            acc[item.id] = current[item.id] ?? item.feedback_text ?? '';
            return acc;
          }, {}),
        );
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

  useEffect(() => {
    return () => {
      void cleanupPlayback();
    };
  }, [cleanupPlayback]);

  const classTitle = useMemo(() => {
    if (detail) {
      return `${detail.class.unit_code} - ${detail.class.unit_title}`;
    }
    return route.params.unitTitle || `Class #${unitId}`;
  }, [detail, route.params.unitTitle, unitId]);

  const latestCall = useMemo(() => calls[0] ?? null, [calls]);
  const submissionsToMark = useMemo(
    () => gradingQueue.filter((item) => item.grade === null || item.grade === undefined || item.grade === ''),
    [gradingQueue],
  );
  const gradedSubmissions = useMemo(
    () => gradingQueue.filter((item) => item.grade !== null && item.grade !== undefined && item.grade !== ''),
    [gradingQueue],
  );

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

  const playSubmissionAudio = useCallback(
    async (submission: SubmissionSummary) => {
      const source = submission.audio_url || submission.audio;
      if (!source) {
        return;
      }
      try {
        await cleanupPlayback();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: source },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        );
        soundRef.current = sound;
        setPlayingSubmissionId(submission.id);
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            return;
          }
          if (status.didJustFinish) {
            void cleanupPlayback();
          }
        });
      } catch (playbackError) {
        if (playbackError instanceof Error) {
          setError(playbackError.message);
        } else {
          setError('Unable to play the submitted voice note.');
        }
      }
    },
    [cleanupPlayback],
  );

  const openSubmissionLink = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (linkError) {
      if (linkError instanceof Error) {
        setError(linkError.message);
      } else {
        setError('Unable to open the submitted document link.');
      }
    }
  }, []);

  const saveGrade = useCallback(
    async (submission: SubmissionSummary) => {
      if (!state.accessToken || savingSubmissionId) {
        return;
      }
      const grade = (gradeDrafts[submission.id] || '').trim();
      if (!grade) {
        setError(`Enter a grade for ${submission.student_name || submission.student_username || 'this student'}.`);
        return;
      }
      setSavingSubmissionId(submission.id);
      setError(null);
      setSuccess(null);
      try {
        await gradeLecturerSubmission(state.accessToken, submission.id, {
          grade,
          feedbackText: feedbackDrafts[submission.id]?.trim() || undefined,
        });
        setSuccess(
          `Saved grade for ${submission.student_name || submission.student_username || 'student'} in ${submission.assignment_title || 'the selected assignment'}.`,
        );
        await loadDetail(true);
      } catch (saveError) {
        if (saveError instanceof Error) {
          setError(saveError.message);
        } else {
          setError('Unable to save the grade.');
        }
      } finally {
        setSavingSubmissionId(null);
      }
    },
    [feedbackDrafts, gradeDrafts, loadDetail, savingSubmissionId, state.accessToken],
  );

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
          <Text style={styles.sectionTitle}>Submissions waiting for grading</Text>
          {submissionsToMark.length ? (
            submissionsToMark.map((submission) => (
              <View key={`submission-pending-${submission.id}`} style={styles.submissionCard}>
                <Text style={styles.submissionTitle}>
                  {submission.student_name || submission.student_username || 'Student'} |{' '}
                  {submission.assignment_title || 'Assignment'}
                </Text>
                <Text style={styles.submissionMeta}>
                  {submission.unit_code || detail?.class.unit_code || ''}{' '}
                  {submission.unit_title || detail?.class.unit_title || ''} | Submitted{' '}
                  {formatDateTime(submission.submitted_at)}
                </Text>
                {submission.text_response ? (
                  <Text style={styles.submissionBody}>{submission.text_response}</Text>
                ) : null}
                {submission.audio_transcript ? (
                  <Text style={styles.submissionTranscript}>
                    Voice transcript: {submission.audio_transcript}
                  </Text>
                ) : null}
                {submission.content_url ? (
                  <VoiceButton
                    label="Open submitted document"
                    onPress={() => openSubmissionLink(submission.content_url)}
                  />
                ) : null}
                {submission.audio_url || submission.audio ? (
                  <VoiceButton
                    label={
                      playingSubmissionId === submission.id
                        ? 'Playing submitted voice note...'
                        : 'Play submitted voice note'
                    }
                    onPress={() => playSubmissionAudio(submission)}
                  />
                ) : null}
                <TextInput
                  value={gradeDrafts[submission.id] ?? ''}
                  onChangeText={(value) =>
                    setGradeDrafts((current) => ({ ...current, [submission.id]: value }))
                  }
                  style={styles.input}
                  placeholder="Enter grade e.g. 78"
                  placeholderTextColor={palette.textSecondary}
                  keyboardType="numeric"
                />
                <TextInput
                  value={feedbackDrafts[submission.id] ?? ''}
                  onChangeText={(value) =>
                    setFeedbackDrafts((current) => ({ ...current, [submission.id]: value }))
                  }
                  style={styles.multilineInput}
                  placeholder="Add lecturer feedback that the student and Guardian can read."
                  placeholderTextColor={palette.textSecondary}
                  multiline
                />
                <VoiceButton
                  label={
                    savingSubmissionId === submission.id ? 'Saving grade...' : 'Save grade and feedback'
                  }
                  onPress={() => saveGrade(submission)}
                />
              </View>
            ))
          ) : (
            <DashboardTile
              title="No ungraded submissions"
              subtitle="New student work for this class will appear here for marking."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently graded submissions</Text>
          {gradedSubmissions.length ? (
            gradedSubmissions.slice(0, 8).map((submission) => (
              <DashboardTile
                key={`submission-graded-${submission.id}`}
                title={`${submission.student_name || submission.student_username || 'Student'} | ${submission.assignment_title || 'Assignment'}`}
                subtitle={`Grade ${submission.grade} | ${submission.unit_code || detail?.class.unit_code || ''} | ${submission.feedback_text?.trim() || 'No written feedback yet.'}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No graded submissions yet"
              subtitle="Saved grades for this class will appear here and on the student side."
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
  submissionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  submissionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  submissionMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  submissionBody: {
    ...typography.body,
    color: palette.textPrimary,
    lineHeight: 22,
  },
  submissionTranscript: {
    ...typography.helper,
    color: palette.textSecondary,
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
  multilineInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    padding: spacing.md,
    color: palette.textPrimary,
    backgroundColor: palette.background,
    minHeight: 96,
    textAlignVertical: 'top',
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
