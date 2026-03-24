import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  createLecturerAssignment,
  deleteLecturerAssignment,
  fetchLecturerAssignments,
  fetchLecturerClassesDashboard,
  fetchLecturerGradingQueue,
  gradeLecturerSubmission,
  updateLecturerAssignment,
  type AssignmentSummary,
  type LecturerClassesDashboard,
  type LecturerClassSummary,
  type SubmissionSummary,
  type WeeklyPlanAssessmentMode,
  type WeeklyPlanAssessmentType,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type LecturerAssignmentsNavigation = NativeStackNavigationProp<RootStackParamList>;
type LecturerAssignmentsRoute = RouteProp<RootStackParamList, 'LecturerAssignments'>;

type AssignmentDraft = {
  title: string;
  dueAt: string;
  assessmentType: WeeklyPlanAssessmentType;
  assessmentMode: WeeklyPlanAssessmentMode;
  notes: string;
  meta: Record<string, unknown> | null;
};

const toIsoInput = (offsetDays: number): string => {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T23:59:00Z`;
};

const createEmptyDraft = (): AssignmentDraft => ({
  title: '',
  dueAt: toIsoInput(7),
  assessmentType: 'assignment',
  assessmentMode: 'mixed',
  notes: '',
  meta: null,
});

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return 'No due date';
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

const parseAssignmentSummary = (assignment: AssignmentSummary) => {
  let notes = assignment.description || '';
  let assessmentType: WeeklyPlanAssessmentType = 'assignment';
  let assessmentMode: WeeklyPlanAssessmentMode = 'mixed';
  let meta: Record<string, unknown> | null = null;

  if ((assignment.description || '').startsWith('[PLAN_META]')) {
    const [metaLine, ...rest] = (assignment.description || '').split('\n');
    const rawMeta = metaLine.slice('[PLAN_META]'.length);
    try {
      const parsed = JSON.parse(rawMeta) as Record<string, unknown>;
      meta = parsed;
      if (parsed.assessment_type === 'cat') {
        assessmentType = 'cat';
      }
      if (typeof parsed.assessment_mode === 'string' && parsed.assessment_mode.trim()) {
        assessmentMode = parsed.assessment_mode.trim();
      }
      notes = rest.join('\n').trim();
    } catch {
      notes = assignment.description || '';
    }
  }

  return {
    notes,
    assessmentType,
    assessmentMode,
    meta,
  };
};

const buildAssignmentDescription = (draft: AssignmentDraft): string => {
  const meta = {
    ...(draft.meta ?? {}),
    planner: draft.meta?.planner ?? false,
    assessment_type: draft.assessmentType,
    assessment_mode: draft.assessmentMode,
    material_links: Array.isArray(draft.meta?.material_links)
      ? draft.meta?.material_links
      : [],
  };
  return `[PLAN_META]${JSON.stringify(meta)}\n${draft.notes.trim()}`;
};

const sortAssignments = (rows: AssignmentSummary[]) =>
  [...rows].sort((left, right) => {
    const leftTime = left.due_at ? Date.parse(left.due_at) : 0;
    const rightTime = right.due_at ? Date.parse(right.due_at) : 0;
    return rightTime - leftTime;
  });

export const LecturerAssignmentsScreen: React.FC = () => {
  const navigation = useNavigation<LecturerAssignmentsNavigation>();
  const route = useRoute<LecturerAssignmentsRoute>();
  const { state, logout, updatePreferences } = useAuth();
  const [dashboard, setDashboard] = useState<LecturerClassesDashboard | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [gradingQueue, setGradingQueue] = useState<SubmissionSummary[]>([]);
  const [draft, setDraft] = useState<AssignmentDraft>(createEmptyDraft());
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<number | null>(null);
  const [savingSubmissionId, setSavingSubmissionId] = useState<number | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<number, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWorkspace = useCallback(
    async (isRefresh = false, preferredUnitId?: number | null) => {
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
        const [dashboardPayload, gradingRows] = await Promise.all([
          fetchLecturerClassesDashboard(state.accessToken),
          fetchLecturerGradingQueue(state.accessToken),
        ]);
        const resolvedUnitId =
          preferredUnitId && dashboardPayload.classes.some((item) => item.unit_id === preferredUnitId)
            ? preferredUnitId
            : route.params?.unitId &&
                dashboardPayload.classes.some((item) => item.unit_id === route.params?.unitId)
              ? route.params.unitId
            : selectedUnitId && dashboardPayload.classes.some((item) => item.unit_id === selectedUnitId)
              ? selectedUnitId
              : dashboardPayload.classes[0]?.unit_id ?? null;
        const assignmentRows = resolvedUnitId
          ? await fetchLecturerAssignments(state.accessToken, resolvedUnitId)
          : [];
        const scopedGradingRows = gradingRows
          .filter((item) => item.unit_id === resolvedUnitId)
          .sort(
            (left, right) =>
              new Date(right.submitted_at || right.updated_at).getTime() -
              new Date(left.submitted_at || left.updated_at).getTime(),
          );
        setDashboard(dashboardPayload);
        setSelectedUnitId(resolvedUnitId);
        setAssignments(sortAssignments(assignmentRows));
        setGradingQueue(scopedGradingRows);
        setGradeDrafts((current) =>
          scopedGradingRows.reduce<Record<number, string>>((acc, item) => {
            acc[item.id] =
              current[item.id] ?? (item.grade !== null && item.grade !== undefined ? String(item.grade) : '');
            return acc;
          }, {}),
        );
        setFeedbackDrafts((current) =>
          scopedGradingRows.reduce<Record<number, string>>((acc, item) => {
            acc[item.id] = current[item.id] ?? item.feedback_text ?? '';
            return acc;
          }, {}),
        );
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load lecturer assignments workspace.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [route.params?.unitId, selectedUnitId, state.accessToken],
  );

  useEffect(() => {
    loadWorkspace(false);
  }, [loadWorkspace]);

  const selectedClass = useMemo<LecturerClassSummary | null>(
    () => dashboard?.classes.find((item) => item.unit_id === selectedUnitId) ?? null,
    [dashboard, selectedUnitId],
  );

  const lecturerName = useMemo(
    () =>
      dashboard?.lecturer.display_name ||
      state.user?.display_name?.trim() ||
      state.user?.username ||
      'Lecturer',
    [dashboard, state.user],
  );

  const pendingClasses = useMemo(
    () =>
      (dashboard?.classes ?? []).filter(
        (item) => item.pending_to_issue > 0 || item.pending_to_mark > 0 || item.pending_messages > 0,
      ),
    [dashboard],
  );
  const submissionsByAssignment = useMemo(
    () =>
      gradingQueue.reduce<Record<number, SubmissionSummary[]>>((acc, submission) => {
        if (!submission.assignment) {
          return acc;
        }
        acc[submission.assignment] = [...(acc[submission.assignment] ?? []), submission];
        return acc;
      }, {}),
    [gradingQueue],
  );

  const resetDraft = useCallback(() => {
    setDraft(createEmptyDraft());
    setEditingAssignmentId(null);
  }, []);

  const beginEdit = (assignment: AssignmentSummary) => {
    const parsed = parseAssignmentSummary(assignment);
    setDraft({
      title: assignment.title,
      dueAt: assignment.due_at || toIsoInput(7),
      assessmentType: parsed.assessmentType,
      assessmentMode: parsed.assessmentMode,
      notes: parsed.notes,
      meta: parsed.meta,
    });
    setEditingAssignmentId(assignment.id);
    setSuccess(null);
    setError(null);
  };

  const saveAssignment = async () => {
    if (!state.accessToken || !selectedUnitId || saving) {
      return;
    }
    if (!draft.title.trim()) {
      setError('Assignment title is required.');
      return;
    }
    if (!draft.dueAt.trim()) {
      setError('Due date is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        unit: selectedUnitId,
        title: draft.title.trim(),
        due_at: draft.dueAt.trim(),
        description: buildAssignmentDescription(draft),
      };
      if (editingAssignmentId) {
        await updateLecturerAssignment(state.accessToken, editingAssignmentId, payload);
        setSuccess('Assignment updated.');
      } else {
        await createLecturerAssignment(state.accessToken, payload);
        setSuccess('Assignment created.');
      }
      resetDraft();
      await loadWorkspace(true, selectedUnitId);
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Unable to save assignment.');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId: number) => {
    if (!state.accessToken || deletingAssignmentId) {
      return;
    }
    setDeletingAssignmentId(assignmentId);
    setError(null);
    setSuccess(null);
    try {
      await deleteLecturerAssignment(state.accessToken, assignmentId);
      if (editingAssignmentId === assignmentId) {
        resetDraft();
      }
      setSuccess('Assignment removed.');
      await loadWorkspace(true, selectedUnitId);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError('Unable to remove assignment.');
      }
    } finally {
      setDeletingAssignmentId(null);
    }
  };

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

  const saveSubmissionGrade = useCallback(
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
        await loadWorkspace(true, selectedUnitId);
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
    [feedbackDrafts, gradeDrafts, loadWorkspace, savingSubmissionId, selectedUnitId, state.accessToken],
  );

  if (loading && !dashboard) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading lecturer assignments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadWorkspace(true)} />}
      >
        <GreetingHeader
          name={lecturerName}
          greeting="Assignments workspace"
          rightAccessory={<RoleBadge role="lecturer" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Assignments workspace error</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadWorkspace(true, selectedUnitId)} />
          </View>
        ) : null}

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Saved</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending lecturer actions</Text>
          {pendingClasses.length ? (
            pendingClasses.map((item) => (
              <DashboardTile
                key={`pending-class-${item.unit_id}`}
                title={`${item.unit_code} needs action`}
                subtitle={`Issue ${item.pending_to_issue} | Mark ${item.pending_to_mark} | Reply ${item.pending_messages}`}
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
              title="No pending lecturer actions"
              subtitle="Current class work, grading, and message queues are clear."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose class</Text>
          <View style={styles.selectorWrap}>
            {(dashboard?.classes ?? []).map((item) => (
              <TouchableOpacity
                key={`assignment-unit-${item.unit_id}`}
                onPress={() => loadWorkspace(false, item.unit_id)}
                style={[
                  styles.selectorChip,
                  selectedUnitId === item.unit_id && styles.selectorChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectorText,
                    selectedUnitId === item.unit_id && styles.selectorTextActive,
                  ]}
                >
                  {item.unit_code}
                </Text>
                <Text
                  style={[
                    styles.selectorSubtext,
                    selectedUnitId === item.unit_id && styles.selectorTextActive,
                  ]}
                >
                  {item.pending_to_issue + item.pending_to_mark + item.pending_messages} open
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedClass ? (
            <DashboardTile
              title={`${selectedClass.unit_code} - ${selectedClass.unit_title}`}
              subtitle={`Students ${selectedClass.students} | Pending issue ${selectedClass.pending_to_issue} | Marking ${selectedClass.pending_to_mark}`}
              onPress={() =>
                navigation.navigate('LecturerClassDetail', {
                  unitId: selectedClass.unit_id,
                  unitTitle: `${selectedClass.unit_code} - ${selectedClass.unit_title}`,
                })
              }
            />
          ) : (
            <DashboardTile
              title="No class selected"
              subtitle="Choose one of your assigned classes to manage assignments."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {editingAssignmentId ? 'Edit current assignment' : 'Add new assignment'}
          </Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              value={draft.title}
              onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))}
              style={styles.input}
              placeholder="Assignment title"
              placeholderTextColor={palette.textSecondary}
            />
            <Text style={styles.inputLabel}>Due date</Text>
            <TextInput
              value={draft.dueAt}
              onChangeText={(value) => setDraft((current) => ({ ...current, dueAt: value }))}
              style={styles.input}
              placeholder="2026-03-31T23:59:00Z"
              placeholderTextColor={palette.textSecondary}
            />
            <Text style={styles.inputLabel}>Assessment type</Text>
            <View style={styles.optionRow}>
              {(['assignment', 'cat'] as WeeklyPlanAssessmentType[]).map((option) => (
                <VoiceButton
                  key={`assignment-type-${option}`}
                  label={option.toUpperCase()}
                  size="compact"
                  isActive={draft.assessmentType === option}
                  onPress={() => setDraft((current) => ({ ...current, assessmentType: option }))}
                />
              ))}
            </View>
            <Text style={styles.inputLabel}>Assessment mode</Text>
            <View style={styles.optionRow}>
              {(['mixed', 'oral', 'physical'] as WeeklyPlanAssessmentMode[]).map((option) => (
                <VoiceButton
                  key={`assignment-mode-${option}`}
                  label={option}
                  size="compact"
                  isActive={draft.assessmentMode === option}
                  onPress={() => setDraft((current) => ({ ...current, assessmentMode: option }))}
                />
              ))}
            </View>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              value={draft.notes}
              onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
              style={[styles.input, styles.multiline]}
              placeholder="What the class should complete, prepare, or submit."
              placeholderTextColor={palette.textSecondary}
              multiline
            />
            <View style={styles.actionRow}>
              <VoiceButton
                label={saving ? 'Saving...' : editingAssignmentId ? 'Update assignment' : 'Create assignment'}
                onPress={selectedUnitId ? saveAssignment : undefined}
                isActive={saving}
                size="compact"
              />
              {editingAssignmentId ? (
                <VoiceButton label="Cancel edit" onPress={resetDraft} size="compact" />
              ) : null}
              {selectedClass ? (
                <VoiceButton
                  label="Weekly planner"
                  onPress={() =>
                    navigation.navigate('LecturerPlanner', {
                      unitId: selectedClass.unit_id,
                      unitTitle: `${selectedClass.unit_code} - ${selectedClass.unit_title}`,
                    })
                  }
                  size="compact"
                />
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current assignments</Text>
          {assignments.length ? (
            assignments.map((assignment) => {
              const parsed = parseAssignmentSummary(assignment);
              const assignmentSubmissions = submissionsByAssignment[assignment.id] ?? [];
              return (
                <View key={`lecturer-assignment-${assignment.id}`} style={styles.assignmentCard}>
                  <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                  <Text style={styles.assignmentMeta}>
                    {parsed.assessmentType.toUpperCase()} | {parsed.assessmentMode} | Due {formatDateTime(assignment.due_at)}
                  </Text>
                  <Text style={styles.assignmentNotes}>
                    {parsed.notes || 'No notes added for this assignment.'}
                  </Text>
                  <Text style={styles.assignmentSubmissionSummary}>
                    Submissions received: {assignmentSubmissions.length}
                  </Text>
                  <View style={styles.actionRow}>
                    <VoiceButton
                      label="Edit"
                      size="compact"
                      onPress={() => beginEdit(assignment)}
                    />
                    <VoiceButton
                      label={deletingAssignmentId === assignment.id ? 'Removing...' : 'Remove'}
                      size="compact"
                      onPress={() => removeAssignment(assignment.id)}
                      isActive={deletingAssignmentId === assignment.id}
                    />
                    {selectedClass ? (
                      <VoiceButton
                        label="Open class"
                        size="compact"
                        onPress={() =>
                          navigation.navigate('LecturerClassDetail', {
                            unitId: selectedClass.unit_id,
                            unitTitle: `${selectedClass.unit_code} - ${selectedClass.unit_title}`,
                          })
                        }
                      />
                    ) : null}
                  </View>
                  {assignmentSubmissions.length ? (
                    <View style={styles.submissionsWrap}>
                      {assignmentSubmissions.map((submission) => (
                        <View key={`assignment-submission-${submission.id}`} style={styles.submissionCard}>
                          <Text style={styles.submissionTitle}>
                            {submission.student_name || submission.student_username || 'Student'}
                          </Text>
                          <Text style={styles.submissionMeta}>
                            Submitted {formatDateTime(submission.submitted_at)}
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
                              size="compact"
                              onPress={() => openSubmissionLink(submission.content_url)}
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
                            style={[styles.input, styles.multiline]}
                            placeholder="Feedback for the student and guardian"
                            placeholderTextColor={palette.textSecondary}
                            multiline
                          />
                          <VoiceButton
                            label={
                              savingSubmissionId === submission.id ? 'Saving grade...' : 'Save grade and feedback'
                            }
                            size="compact"
                            onPress={() => saveSubmissionGrade(submission)}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <DashboardTile
                      title="No student submission on this assignment yet"
                      subtitle="When students submit work, it will appear directly under this assignment."
                      disabled
                    />
                  )}
                </View>
              );
            })
          ) : (
            <DashboardTile
              title="No assignments in this class yet"
              subtitle="Use the form above or weekly planner to add the current class work."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'My classes', onPress: () => navigation.navigate('LecturerClasses') },
          ...(selectedClass
            ? [
                {
                  label: 'Open class',
                  onPress: () =>
                    navigation.navigate('LecturerClassDetail', {
                      unitId: selectedClass.unit_id,
                      unitTitle: `${selectedClass.unit_code} - ${selectedClass.unit_title}`,
                    }),
                },
              ]
            : []),
          { label: 'Messages', onPress: () => navigation.navigate('MessageThreads', { role: 'lecturer' }) },
          { label: 'Refresh', onPress: () => loadWorkspace(true, selectedUnitId) },
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
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputLabel: {
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
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorChip: {
    minWidth: 104,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: spacing.xs,
  },
  selectorChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  selectorText: {
    ...typography.body,
    color: palette.textPrimary,
  },
  selectorSubtext: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  selectorTextActive: {
    color: palette.surface,
  },
  assignmentCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  assignmentTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  assignmentMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  assignmentNotes: {
    ...typography.body,
    color: palette.textPrimary,
  },
  assignmentSubmissionSummary: {
    ...typography.helper,
    color: palette.primary,
  },
  submissionsWrap: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  submissionCard: {
    backgroundColor: palette.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  submissionTitle: {
    ...typography.body,
    color: palette.textPrimary,
  },
  submissionMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  submissionBody: {
    ...typography.body,
    color: palette.textPrimary,
  },
  submissionTranscript: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
});
