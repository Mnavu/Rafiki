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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  assignDepartmentHod,
  assignDepartmentLecturer,
  assignOfferingLecturer,
  clearOfferingLecturer,
  fetchDepartments,
  fetchDepartmentStaffPool,
  fetchDepartmentStructure,
  fetchHodCourseMatrix,
  removeDepartmentLecturer,
  type DepartmentStaffPool,
  type DepartmentStructure,
  type DepartmentSummary,
  type HodCourseMatrix,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type RecordsNav = NativeStackNavigationProp<RootStackParamList>;

export const RecordsControlCenterScreen: React.FC = () => {
  const navigation = useNavigation<RecordsNav>();
  const { state, logout, updatePreferences } = useAuth();
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [structure, setStructure] = useState<DepartmentStructure | null>(null);
  const [staffPool, setStaffPool] = useState<DepartmentStaffPool | null>(null);
  const [matrix, setMatrix] = useState<HodCourseMatrix | null>(null);
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [trimester, setTrimester] = useState('1');
  const [offeringLecturerDraft, setOfferingLecturerDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const badgeRole = state.user?.role === 'hod' ? 'hod' : 'records';

  const loadDepartments = useCallback(
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
        const rows = await fetchDepartments(state.accessToken);
        setDepartments(rows);
        if (!selectedDepartmentId && rows.length) {
          setSelectedDepartmentId(rows[0].id);
        }
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load departments.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDepartmentId, state.accessToken],
  );

  const loadDepartmentScope = useCallback(
    async (departmentId: number, isRefresh = false) => {
      if (!state.accessToken) {
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else if (!structure) {
        setLoading(true);
      }
      setError(null);
      try {
        const yearValue = Number.parseInt(academicYear, 10) || new Date().getFullYear();
        const trimesterValue = Number.parseInt(trimester, 10) || undefined;
        const [structurePayload, poolPayload, matrixPayload] = await Promise.all([
          fetchDepartmentStructure(state.accessToken, departmentId),
          fetchDepartmentStaffPool(state.accessToken, departmentId),
          fetchHodCourseMatrix(state.accessToken, departmentId, {
            academic_year: yearValue,
            trimester: trimesterValue,
          }),
        ]);
        setStructure(structurePayload);
        setStaffPool(poolPayload);
        setMatrix(matrixPayload);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load department control center.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [academicYear, state.accessToken, trimester],
  );

  useEffect(() => {
    loadDepartments(false);
  }, [loadDepartments]);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadDepartmentScope(selectedDepartmentId, false);
    }
  }, [selectedDepartmentId]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (!selectedDepartmentId || !state.accessToken || actionKey) {
      return;
    }
    setActionKey(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await loadDepartmentScope(selectedDepartmentId, true);
    } catch (actionError) {
      if (actionError instanceof Error) {
        setError(actionError.message);
      } else {
        setError('Action failed.');
      }
    } finally {
      setActionKey(null);
    }
  };

  const assignHod = async (hodUserId: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    await runAction(`hod-${hodUserId}`, async () => {
      const response = await assignDepartmentHod(state.accessToken!, selectedDepartmentId, hodUserId);
      setSuccess(response.detail);
    });
  };

  const assignLecturer = async (lecturerUserId: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    await runAction(`assign-lecturer-${lecturerUserId}`, async () => {
      const response = await assignDepartmentLecturer(
        state.accessToken!,
        selectedDepartmentId,
        lecturerUserId,
      );
      setSuccess(response.detail);
    });
  };

  const removeLecturer = async (lecturerUserId: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    await runAction(`remove-lecturer-${lecturerUserId}`, async () => {
      const response = await removeDepartmentLecturer(
        state.accessToken!,
        selectedDepartmentId,
        lecturerUserId,
      );
      setSuccess(response.detail);
    });
  };

  const assignOffering = async (offeringId: number, unitId: number, currentTrimester: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    const lecturerUserId = Number.parseInt(offeringLecturerDraft[offeringId] || '', 10);
    if (!lecturerUserId) {
      setError('Enter a valid lecturer user ID for this course offering.');
      return;
    }
    const yearValue = Number.parseInt(academicYear, 10) || new Date().getFullYear();
    await runAction(`offering-assign-${offeringId}`, async () => {
      const response = await assignOfferingLecturer(state.accessToken!, selectedDepartmentId, {
        unit_id: unitId,
        lecturer_user_id: lecturerUserId,
        academic_year: yearValue,
        trimester: currentTrimester || Number.parseInt(trimester, 10) || 1,
      });
      setSuccess(response.detail);
      setOfferingLecturerDraft((current) => ({ ...current, [offeringId]: '' }));
    });
  };

  const clearOffering = async (offeringId: number, unitId: number, currentTrimester: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    const yearValue = Number.parseInt(academicYear, 10) || new Date().getFullYear();
    await runAction(`offering-clear-${offeringId}`, async () => {
      const response = await clearOfferingLecturer(state.accessToken!, selectedDepartmentId, {
        unit_id: unitId,
        academic_year: yearValue,
        trimester: currentTrimester || Number.parseInt(trimester, 10) || 1,
      });
      setSuccess(response.detail);
    });
  };

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId],
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading records control center...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (selectedDepartmentId) {
                loadDepartmentScope(selectedDepartmentId, true);
              } else {
                loadDepartments(true);
              }
            }}
          />
        }
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Records'}
          greeting="Records control center"
          rightAccessory={<RoleBadge role={badgeRole} />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Records workflow error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Update completed</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Department scope</Text>
          {departments.length ? (
            departments.map((department, index) => (
              <DashboardTile
                key={`department-${department.id}-${index}`}
                title={department.name}
                subtitle={`${department.code}${selectedDepartmentId === department.id ? '  |  Active' : ''}`}
                onPress={() => setSelectedDepartmentId(department.id)}
                statusColor={selectedDepartmentId === department.id ? palette.primary : undefined}
              />
            ))
          ) : (
            <DashboardTile
              title="No departments available"
              subtitle="Ask admin to configure department records."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic filters</Text>
          <View style={styles.card}>
            <TextInput
              value={academicYear}
              onChangeText={setAcademicYear}
              style={styles.input}
              placeholder="Academic year"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
            />
            <TextInput
              value={trimester}
              onChangeText={setTrimester}
              style={styles.input}
              placeholder="Trimester"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
            />
            <VoiceButton
              label="Reload matrix with filters"
              onPress={() => selectedDepartmentId && loadDepartmentScope(selectedDepartmentId, true)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Department leadership</Text>
          <DashboardTile
            title={selectedDepartment ? `${selectedDepartment.name} leadership` : 'Department leadership'}
            subtitle={
              structure?.hod
                ? `Current HOD: ${structure.hod.name}`
                : 'No HOD assigned. Select one below.'
            }
            disabled
          />
          {staffPool?.hods.length ? (
            staffPool.hods.map((hod) => (
              <DashboardTile
                key={`hod-${hod.user_id}`}
                title={hod.name}
                subtitle={
                  hod.is_current
                    ? 'Already assigned to this department'
                    : hod.department_name
                      ? `Currently in ${hod.department_name}`
                      : 'Unassigned'
                }
                onPress={() => assignHod(hod.user_id)}
                disabled={actionKey === `hod-${hod.user_id}`}
              />
            ))
          ) : (
            <DashboardTile
              title="No HOD candidates found"
              subtitle="Create HOD accounts first, then assign one here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lecturer department mapping</Text>
          {structure?.lecturers.length ? (
            structure.lecturers.map((lecturer) => (
              <View key={`dept-lecturer-${lecturer.user_id}`} style={styles.inlineActions}>
                <DashboardTile
                  title={lecturer.name}
                  subtitle="Assigned lecturer in this department"
                  disabled
                  style={styles.flexTile}
                />
                <VoiceButton
                  label="Remove"
                  onPress={() => removeLecturer(lecturer.user_id)}
                />
              </View>
            ))
          ) : (
            <DashboardTile
              title="No lecturers mapped yet"
              subtitle="Assign lecturers from the pool below."
              disabled
            />
          )}
          {staffPool?.lecturers.length ? (
            staffPool.lecturers
              .filter((lecturer) => !lecturer.is_current)
              .slice(0, 20)
              .map((lecturer) => (
                <DashboardTile
                  key={`pool-lecturer-${lecturer.user_id}`}
                  title={lecturer.name}
                  subtitle={
                    lecturer.department_name
                      ? `Currently in ${lecturer.department_name}`
                      : 'Unassigned lecturer'
                  }
                  onPress={() => assignLecturer(lecturer.user_id)}
                  disabled={actionKey === `assign-lecturer-${lecturer.user_id}`}
                />
              ))
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course offering lecturer assignment</Text>
          {matrix?.offerings.length ? (
            matrix.offerings.map((offering, index) => (
              <View key={`offering-${offering.term_offering_id}-${index}`} style={styles.card}>
                <Text style={styles.offeringTitle}>
                  {offering.unit_code} - {offering.unit_title}
                </Text>
                <Text style={styles.helper}>
                  Programme: {offering.programme_name} | Trimester {offering.trimester}
                </Text>
                <Text style={styles.helper}>
                  Current lecturer: {offering.lecturer_name || 'Not assigned'}
                </Text>
                <TextInput
                  value={offeringLecturerDraft[offering.term_offering_id] ?? ''}
                  onChangeText={(value) =>
                    setOfferingLecturerDraft((current) => ({
                      ...current,
                      [offering.term_offering_id]: value,
                    }))
                  }
                  style={styles.input}
                  placeholder="Lecturer user ID"
                  placeholderTextColor={palette.textSecondary}
                  keyboardType="number-pad"
                />
                <View style={styles.buttonRow}>
                  <VoiceButton
                    label="Assign/update lecturer"
                    onPress={() =>
                      assignOffering(
                        offering.term_offering_id,
                        offering.unit_id,
                        offering.trimester,
                      )
                    }
                  />
                  <VoiceButton
                    label="Clear lecturer"
                    onPress={() =>
                      clearOffering(
                        offering.term_offering_id,
                        offering.unit_id,
                        offering.trimester,
                      )
                    }
                  />
                </View>
              </View>
            ))
          ) : (
            <DashboardTile
              title="No active term offerings"
              subtitle="Create or open term offerings before lecturer assignment."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          {
            label: 'Refresh control center',
            onPress: () => selectedDepartmentId && loadDepartmentScope(selectedDepartmentId, true),
          },
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
  card: {
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
  offeringTitle: {
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
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flexTile: {
    flex: 1,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
