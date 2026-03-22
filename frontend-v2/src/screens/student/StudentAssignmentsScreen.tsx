import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import {
  fetchStudentAssignments,
  fetchStudentSubmissions,
  submitStudentSubmission,
  transcribeAudio,
  type AssignmentSummary,
  type SubmissionSummary,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

const dedupeByKey = <T,>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No due date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No due date';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const StudentAssignmentsScreen: React.FC = () => {
  const { state, logout, updatePreferences } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [textResponse, setTextResponse] = useState('');
  const [documentLink, setDocumentLink] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioUri, setAudioUri] = useState<string | undefined>(undefined);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const loadData = useCallback(
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
        const [assignmentRows, submissionRows] = await Promise.all([
          fetchStudentAssignments(state.accessToken),
          fetchStudentSubmissions(state.accessToken),
        ]);
        const sortedAssignments = dedupeByKey(
          [...assignmentRows].sort((left, right) => {
            const leftDate = Date.parse(left.due_at ?? '') || Number.MAX_SAFE_INTEGER;
            const rightDate = Date.parse(right.due_at ?? '') || Number.MAX_SAFE_INTEGER;
            return leftDate - rightDate;
          }),
          (assignment) => String(assignment.id),
        );
        const latestSubmissions = dedupeByKey(
          [...submissionRows].sort((left, right) => {
            const leftDate = Date.parse(left.submitted_at ?? '') || 0;
            const rightDate = Date.parse(right.submitted_at ?? '') || 0;
            return rightDate - leftDate;
          }),
          (submission) => String(submission.assignment),
        );
        setAssignments(sortedAssignments);
        setSubmissions(latestSubmissions);
        setSelectedAssignmentId((current) =>
          current && sortedAssignments.some((item) => item.id === current)
            ? current
            : sortedAssignments[0]?.id ?? null,
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load assignments.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return () => {
      const activeRecording = recordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => undefined);
        recordingRef.current = null;
      }
    };
  }, []);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );

  const selectedSubmission = useMemo(
    () =>
      submissions.find((item) => item.assignment === selectedAssignmentId) ??
      null,
    [selectedAssignmentId, submissions],
  );

  useEffect(() => {
    setTextResponse(selectedSubmission?.text_response ?? '');
    setDocumentLink(selectedSubmission?.content_url ?? '');
    setAudioTranscript(selectedSubmission?.audio_transcript ?? '');
    setAudioUri(undefined);
  }, [selectedSubmission?.id]);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission', 'Microphone permission is required for voice submission.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording: nextRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = nextRecording;
      setRecording(true);
      setSpeechStatus('Recording your voice answer...');
    } catch (recordError) {
      setSpeechStatus(null);
      Alert.alert(
        'Voice recording error',
        recordError instanceof Error ? recordError.message : 'Could not start recording.',
      );
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording || !state.accessToken) {
      return;
    }
    setRecording(false);
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI() ?? undefined;
      recordingRef.current = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (!uri) {
        throw new Error('No audio file was created.');
      }
      setAudioUri(uri);
      setSpeechStatus('Converting your voice answer to text...');
      const transcript = await transcribeAudio(state.accessToken, { audioUri: uri });
      const text = transcript.text?.trim() ?? '';
      if (text) {
        setAudioTranscript(text);
        setTextResponse((current) => (current.trim() ? current : text));
        setSpeechStatus('Voice answer is ready. Review and submit.');
      } else {
        setSpeechStatus('Voice recorded, but no clear words were recognized.');
      }
    } catch (recordError) {
      setSpeechStatus(null);
      Alert.alert(
        'Voice recording error',
        recordError instanceof Error ? recordError.message : 'Could not process the voice note.',
      );
    }
  }, [state.accessToken]);

  const handleSubmit = useCallback(async () => {
    if (!state.accessToken || !selectedAssignment) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitStudentSubmission(state.accessToken, {
        assignmentId: selectedAssignment.id,
        contentUrl: documentLink,
        textResponse,
        audioTranscript,
        audioUri,
      });
      setSpeechStatus('Assignment submitted successfully.');
      await loadData(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the assignment.');
    } finally {
      setSaving(false);
    }
  }, [audioTranscript, audioUri, documentLink, loadData, selectedAssignment, state.accessToken, textResponse]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading assignments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Student'}
          greeting="Assignments"
          rightAccessory={<RoleBadge role="student" />}
        />

        {speechStatus ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{speechStatus}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Assignment error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your assignments</Text>
          {assignments.length ? (
            assignments.map((assignment) => {
              const submission = submissions.find((item) => item.assignment === assignment.id);
              return (
                <DashboardTile
                  key={`student-assignment-${assignment.id}`}
                  icon={
                    <MaterialCommunityIcons
                      name={submission ? 'clipboard-check' : 'clipboard-text-clock'}
                      size={26}
                      color={submission ? palette.success : palette.primary}
                    />
                  }
                  title={assignment.title}
                  subtitle={`${assignment.unit_code ?? ''} ${assignment.unit_title} | Due ${formatDateTime(assignment.due_at)}${submission ? ' | Submitted' : ''}`}
                  onPress={() => setSelectedAssignmentId(assignment.id)}
                  statusColor={selectedAssignmentId === assignment.id ? palette.primary : undefined}
                />
              );
            })
          ) : (
            <DashboardTile
              title="No assignments yet"
              subtitle="Demo assignments will appear here once seeded for your registered units."
              disabled
            />
          )}
        </View>

        {selectedAssignment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Submit assignment</Text>
            <View style={styles.detailCard}>
              <Text style={styles.assignmentTitle}>{selectedAssignment.title}</Text>
              <Text style={styles.assignmentMeta}>
                {selectedAssignment.unit_code ?? ''} {selectedAssignment.unit_title} | Due {formatDateTime(selectedAssignment.due_at)}
              </Text>
              <Text style={styles.assignmentDescription}>{selectedAssignment.description}</Text>

              {selectedSubmission ? (
                <View style={styles.submissionSummary}>
                  <Text style={styles.submissionSummaryTitle}>Current submission</Text>
                  <Text style={styles.submissionSummaryText}>
                    Submitted {formatDateTime(selectedSubmission.submitted_at)}
                    {selectedSubmission.grade !== null && selectedSubmission.grade !== undefined
                      ? ` | Grade ${selectedSubmission.grade}`
                      : ''}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.label}>Written answer</Text>
              <TextInput
                multiline
                value={textResponse}
                onChangeText={setTextResponse}
                style={styles.multilineInput}
                placeholder="Write the answer here or fill it using voice-to-text."
                placeholderTextColor={palette.textSecondary}
              />

              <Text style={styles.label}>Document link</Text>
              <TextInput
                value={documentLink}
                onChangeText={setDocumentLink}
                style={styles.input}
                placeholder="Paste a Google Drive, PDF, or shared document link."
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={palette.textSecondary}
              />

              <Text style={styles.label}>Voice transcript</Text>
              <TextInput
                multiline
                value={audioTranscript}
                onChangeText={setAudioTranscript}
                style={styles.multilineInput}
                placeholder="Your speech-to-text answer will appear here."
                placeholderTextColor={palette.textSecondary}
              />

              <View style={styles.buttonRow}>
                <VoiceButton
                  label={recording ? 'Stop voice' : 'Record voice'}
                  onPress={recording ? stopRecording : startRecording}
                  isActive={recording}
                  style={styles.actionButton}
                />
                <VoiceButton
                  label={saving ? 'Submitting...' : 'Submit work'}
                  onPress={saving ? undefined : handleSubmit}
                  isActive={!saving}
                  style={styles.actionButton}
                />
              </View>
              <Text style={styles.helper}>
                You can submit with a written answer, a document link, or a voice note with speech-to-text.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Refresh', onPress: () => loadData(true) },
          {
            label: recording ? 'Stop voice' : 'Record voice',
            onPress: recording ? stopRecording : startRecording,
          },
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
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  statusCard: {
    backgroundColor: '#E8F1FF',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statusText: {
    ...typography.helper,
    color: palette.primary,
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
  detailCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  assignmentTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  assignmentMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  assignmentDescription: {
    ...typography.body,
    color: palette.textPrimary,
  },
  submissionSummary: {
    backgroundColor: '#EFFCF5',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  submissionSummaryTitle: {
    ...typography.helper,
    color: palette.success,
  },
  submissionSummaryText: {
    ...typography.helper,
    color: palette.textPrimary,
  },
  label: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  input: {
    backgroundColor: palette.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
  },
  multilineInput: {
    minHeight: 116,
    textAlignVertical: 'top',
    backgroundColor: palette.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '48%',
  },
});
