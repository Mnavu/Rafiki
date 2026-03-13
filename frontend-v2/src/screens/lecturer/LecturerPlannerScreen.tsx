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
  fetchLecturerAttendanceSheets,
  fetchLecturerWeeklyPlanner,
  publishLecturerWeeklyPlanner,
  uploadLecturerAttendanceSheet,
  type AttendanceSheetSummary,
  type WeeklyPlanBucket,
  type WeeklyPlanPublishItem,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type PlannerRoute = RouteProp<RootStackParamList, 'LecturerPlanner'>;
type PlannerNavigation = NativeStackNavigationProp<RootStackParamList>;

type PlanDraftItem = WeeklyPlanPublishItem & { material_links_text: string };

const toWeekStartDate = (): string => {
  const now = new Date();
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  now.setDate(now.getDate() + mondayOffset);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toIsoDateTime = (offsetDays: number): string => {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T23:59:00Z`;
};

const parseAttendanceRows = (
  rawText: string,
): { student_user_id: number; present: boolean; notes?: string }[] => {
  const rows = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return rows.map((row, index) => {
    const [idText, presentText = 'true', ...rest] = row.split(',').map((part) => part.trim());
    const studentId = Number.parseInt(idText, 10);
    if (!studentId) {
      throw new Error(`Attendance row ${index + 1} has invalid student_user_id.`);
    }
    const normalized = presentText.toLowerCase();
    const present = ['1', 'true', 'yes', 'present', 'y'].includes(normalized);
    const notes = rest.join(', ').trim();
    return {
      student_user_id: studentId,
      present,
      ...(notes ? { notes } : {}),
    };
  });
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const initialPlanItems: PlanDraftItem[] = [
  {
    assessment_type: 'assignment',
    title: '',
    due_at: toIsoDateTime(3),
    assessment_mode: 'mixed',
    notes: '',
    material_links: [],
    material_links_text: '',
  },
  {
    assessment_type: 'assignment',
    title: '',
    due_at: toIsoDateTime(5),
    assessment_mode: 'mixed',
    notes: '',
    material_links: [],
    material_links_text: '',
  },
  {
    assessment_type: 'cat',
    title: '',
    due_at: toIsoDateTime(7),
    assessment_mode: 'mixed',
    notes: '',
    material_links: [],
    material_links_text: '',
  },
];

export const LecturerPlannerScreen: React.FC = () => {
  const route = useRoute<PlannerRoute>();
  const navigation = useNavigation<PlannerNavigation>();
  const { state, logout, updatePreferences } = useAuth();
  const { unitId, unitTitle } = route.params;
  const [plannerBuckets, setPlannerBuckets] = useState<WeeklyPlanBucket[]>([]);
  const [attendanceSheets, setAttendanceSheets] = useState<AttendanceSheetSummary[]>([]);
  const [weekStart, setWeekStart] = useState(toWeekStartDate());
  const [planItems, setPlanItems] = useState<PlanDraftItem[]>(initialPlanItems);
  const [attendanceRaw, setAttendanceRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingAttendance, setUploadingAttendance] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPlanner = useCallback(
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
        const [plannerRows, attendanceRows] = await Promise.all([
          fetchLecturerWeeklyPlanner(state.accessToken, unitId),
          fetchLecturerAttendanceSheets(state.accessToken, unitId).catch(() => []),
        ]);
        setPlannerBuckets(plannerRows);
        setAttendanceSheets(attendanceRows);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load weekly planner data.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken, unitId],
  );

  useEffect(() => {
    loadPlanner(false);
  }, [loadPlanner]);

  const headerTitle = useMemo(() => unitTitle || `Unit #${unitId}`, [unitId, unitTitle]);

  const updateItem = (index: number, updates: Partial<PlanDraftItem>) => {
    setPlanItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)),
    );
  };

  const publishPlan = async () => {
    if (!state.accessToken || publishing) {
      return;
    }
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const items: WeeklyPlanPublishItem[] = planItems.map((item) => ({
        title: item.title.trim(),
        due_at: item.due_at.trim(),
        assessment_type: item.assessment_type,
        assessment_mode: item.assessment_mode?.trim() || 'mixed',
        material_links: item.material_links_text
          .split('\n')
          .map((row) => row.trim())
          .filter(Boolean),
        notes: item.notes?.trim(),
      }));
      await publishLecturerWeeklyPlanner(state.accessToken, {
        unit_id: unitId,
        week_start: weekStart.trim(),
        items,
      });
      setSuccess('Weekly planner published with strict 2 assignments + 1 CAT guardrail.');
      await loadPlanner(true);
    } catch (publishError) {
      if (publishError instanceof Error) {
        setError(publishError.message);
      } else {
        setError('Unable to publish weekly planner.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const uploadAttendance = async () => {
    if (!state.accessToken || uploadingAttendance) {
      return;
    }
    setUploadingAttendance(true);
    setError(null);
    setSuccess(null);
    try {
      const rows = parseAttendanceRows(attendanceRaw);
      if (!rows.length) {
        throw new Error('Provide at least one attendance row.');
      }
      await uploadLecturerAttendanceSheet(state.accessToken, {
        unit_id: unitId,
        week_start: weekStart.trim(),
        rows,
      });
      setSuccess('Attendance sheet uploaded and notifications sent to department managers.');
      setAttendanceRaw('');
      await loadPlanner(true);
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else {
        setError('Unable to upload attendance sheet.');
      }
    } finally {
      setUploadingAttendance(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading weekly planner...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPlanner(true)} />}
      >
        <GreetingHeader
          name={headerTitle}
          greeting="Weekly planner and attendance"
          rightAccessory={<RoleBadge role="lecturer" />}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authoring guardrails</Text>
          <DashboardTile
            title="Fixed weekly structure"
            subtitle="Each publish requires exactly 2 assignments and 1 CAT. The server blocks any other mix."
            disabled
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Planner error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Success</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publish weekly plan</Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Week start (YYYY-MM-DD)</Text>
            <TextInput
              value={weekStart}
              onChangeText={setWeekStart}
              style={styles.input}
              placeholder="2026-03-09"
              placeholderTextColor={palette.textSecondary}
            />
            {planItems.map((item, index) => (
              <View key={`${item.assessment_type}-${index}`} style={styles.planItem}>
                <Text style={styles.planTitle}>
                  {item.assessment_type === 'cat' ? 'CAT item' : `Assignment ${index + 1}`}
                </Text>
                <TextInput
                  value={item.title}
                  onChangeText={(value) => updateItem(index, { title: value })}
                  style={styles.input}
                  placeholder="Title"
                  placeholderTextColor={palette.textSecondary}
                />
                <TextInput
                  value={item.due_at}
                  onChangeText={(value) => updateItem(index, { due_at: value })}
                  style={styles.input}
                  placeholder="Due at (ISO datetime)"
                  placeholderTextColor={palette.textSecondary}
                />
                <TextInput
                  value={String(item.assessment_mode ?? 'mixed')}
                  onChangeText={(value) => updateItem(index, { assessment_mode: value })}
                  style={styles.input}
                  placeholder="assessment mode (oral|physical|mixed)"
                  placeholderTextColor={palette.textSecondary}
                />
                <TextInput
                  value={item.material_links_text}
                  onChangeText={(value) => updateItem(index, { material_links_text: value })}
                  style={[styles.input, styles.multiline]}
                  placeholder="Material links (one per line)"
                  placeholderTextColor={palette.textSecondary}
                  multiline
                />
                <TextInput
                  value={item.notes || ''}
                  onChangeText={(value) => updateItem(index, { notes: value })}
                  style={[styles.input, styles.multiline]}
                  placeholder="Weekly notes"
                  placeholderTextColor={palette.textSecondary}
                  multiline
                />
              </View>
            ))}
            <VoiceButton
              label={publishing ? 'Publishing...' : 'Publish week plan'}
              onPress={publishPlan}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance upload</Text>
          <View style={styles.card}>
            <Text style={styles.helper}>
              Format: `student_user_id,present,notes` on each line. Example: `34,true,Present on time`
            </Text>
            <TextInput
              value={attendanceRaw}
              onChangeText={setAttendanceRaw}
              style={[styles.input, styles.multilineLarge]}
              placeholder="34,true,Present on time"
              placeholderTextColor={palette.textSecondary}
              multiline
            />
            <VoiceButton
              label={uploadingAttendance ? 'Uploading...' : 'Upload attendance'}
              onPress={uploadAttendance}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Published planner history</Text>
          {plannerBuckets.length ? (
            plannerBuckets.map((bucket, index) => (
              <DashboardTile
                key={`planner-bucket-${bucket.week_start}-${index}`}
                title={`Week ${bucket.week_start}`}
                subtitle={`${bucket.items.length} assessments  |  ${bucket.items
                  .map((item) => item.title)
                  .slice(0, 2)
                  .join(' | ')}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No planner history yet"
              subtitle="Publish your first weekly plan to start tracking."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance history</Text>
          {attendanceSheets.length ? (
            attendanceSheets.map((sheet, index) => (
              <DashboardTile
                key={`attendance-sheet-${sheet.sheet_id}-${index}`}
                title={`${sheet.unit_code} attendance - ${sheet.week_start}`}
                subtitle={`${sheet.rows.length} rows  |  Uploaded ${formatDateTime(sheet.uploaded_at)}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No attendance uploads yet"
              subtitle="Uploaded attendance sheets for this class will appear here."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Refresh planner', onPress: () => loadPlanner(true) },
          { label: 'Back to class', onPress: () => navigation.goBack() },
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
    minHeight: 74,
    textAlignVertical: 'top',
  },
  multilineLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  planItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: palette.background,
  },
  planTitle: {
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
