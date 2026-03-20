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
  approveProvisionRequest,
  approveHodRegistrations,
  assignDepartmentHod,
  assignDepartmentLecturer,
  assignOfferingLecturer,
  clearOfferingLecturer,
  enrollFamily,
  fetchDepartments,
  fetchDepartmentStaffPool,
  fetchDepartmentStructure,
  fetchHodPendingApprovals,
  fetchHodCourseMatrix,
  fetchProgrammes,
  fetchProvisionRequests,
  fetchStudentRegistrations,
  removeDepartmentLecturer,
  rejectHodRegistrations,
  rejectProvisionRequest,
  type FamilyEnrollmentPayload,
  type DepartmentStaffPool,
  type DepartmentStructure,
  type DepartmentSummary,
  type HodCourseMatrix,
  type ProgrammeSummary,
  type RegistrationSummary,
  type UserProvisionRequestSummary,
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
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [provisionRequests, setProvisionRequests] = useState<UserProvisionRequestSummary[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationSummary[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<RegistrationSummary[]>([]);
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [trimester, setTrimester] = useState('1');
  const [offeringLecturerDraft, setOfferingLecturerDraft] = useState<Record<number, string>>({});
  const currentYear = new Date().getFullYear();
  const [recordsPasscode, setRecordsPasscode] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('Student@2026');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentLastName, setStudentLastName] = useState('');
  const [studentDisplayName, setStudentDisplayName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [guardianUsername, setGuardianUsername] = useState('');
  const [guardianPassword, setGuardianPassword] = useState('Guardian@2026');
  const [guardianFirstName, setGuardianFirstName] = useState('');
  const [guardianLastName, setGuardianLastName] = useState('');
  const [guardianDisplayName, setGuardianDisplayName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [relationship, setRelationship] = useState('Guardian');
  const [programmeId, setProgrammeId] = useState('');
  const [studyYear, setStudyYear] = useState('1');
  const [studyTrimester, setStudyTrimester] = useState('1');
  const [trimesterLabel, setTrimesterLabel] = useState('Year 1 Trimester 1');
  const [cohortYear, setCohortYear] = useState(String(currentYear));
  const [feeTitle, setFeeTitle] = useState('Tuition');
  const [feeAmount, setFeeAmount] = useState('30000');
  const [feeDueDate, setFeeDueDate] = useState('');
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
        const [rows, programmeRows, requestRows, registrationRows, approvalRows] = await Promise.all([
          fetchDepartments(state.accessToken),
          fetchProgrammes(state.accessToken),
          fetchProvisionRequests(state.accessToken),
          fetchStudentRegistrations(state.accessToken),
          badgeRole === 'hod' ? fetchHodPendingApprovals(state.accessToken) : Promise.resolve([]),
        ]);
        setDepartments(rows);
        setProgrammes(programmeRows);
        setProvisionRequests(requestRows);
        setRegistrations(registrationRows);
        setPendingApprovals(approvalRows);
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
        const [structurePayload, poolPayload, matrixPayload, registrationPayload, approvalPayload] = await Promise.all([
          fetchDepartmentStructure(state.accessToken, departmentId),
          fetchDepartmentStaffPool(state.accessToken, departmentId),
          fetchHodCourseMatrix(state.accessToken, departmentId, {
            academic_year: yearValue,
            trimester: trimesterValue,
          }),
          fetchStudentRegistrations(state.accessToken),
          badgeRole === 'hod' ? fetchHodPendingApprovals(state.accessToken) : Promise.resolve([]),
        ]);
        setStructure(structurePayload);
        setStaffPool(poolPayload);
        setMatrix(matrixPayload);
        setRegistrations(registrationPayload);
        setPendingApprovals(approvalPayload);
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
    [academicYear, badgeRole, state.accessToken, trimester],
  );

  useEffect(() => {
    loadDepartments(false);
  }, [loadDepartments]);

  useEffect(() => {
    if (selectedDepartmentId) {
      loadDepartmentScope(selectedDepartmentId, false);
    }
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (!programmeId && programmes.length) {
      setProgrammeId(String(programmes[0].id));
    }
  }, [programmeId, programmes]);

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

  const runGlobalAction = async (key: string, action: () => Promise<void>) => {
    if (!state.accessToken || actionKey) {
      return;
    }
    setActionKey(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await loadDepartments(true);
      if (selectedDepartmentId) {
        await loadDepartmentScope(selectedDepartmentId, true);
      }
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

  const pendingProvisionRequests = useMemo(
    () =>
      provisionRequests
        .filter((item) => item.status === 'pending')
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 12),
    [provisionRequests],
  );

  const createStudentEnrollment = async () => {
    if (!state.accessToken) {
      return;
    }
    const parsedProgramme = Number.parseInt(programmeId, 10);
    const parsedYear = Number.parseInt(studyYear, 10);
    const parsedTrimester = Number.parseInt(studyTrimester, 10);
    const parsedCohortYear = Number.parseInt(cohortYear, 10);
    const parsedFeeAmount = Number.parseFloat(feeAmount);
    if (!recordsPasscode.trim()) {
      setError('Records passcode is required for onboarding.');
      return;
    }
    if (!studentUsername.trim() || !guardianUsername.trim()) {
      setError('Student and guardian usernames are required.');
      return;
    }
    if (!studentPassword.trim() || !guardianPassword.trim()) {
      setError('Student and guardian passwords are required.');
      return;
    }
    if (!parsedProgramme || !parsedYear || !parsedTrimester || !parsedCohortYear) {
      setError('Programme, year, trimester, and cohort year are required.');
      return;
    }
    if (Number.isNaN(parsedFeeAmount) || parsedFeeAmount <= 0) {
      setError('Fee amount must be greater than zero.');
      return;
    }

    const payload: FamilyEnrollmentPayload = {
      records_passcode: recordsPasscode.trim(),
      student: {
        username: studentUsername.trim().toLowerCase(),
        password: studentPassword,
        first_name: studentFirstName.trim() || undefined,
        last_name: studentLastName.trim() || undefined,
        display_name: studentDisplayName.trim() || undefined,
        email: studentEmail.trim() || undefined,
      },
      parent: {
        username: guardianUsername.trim().toLowerCase(),
        password: guardianPassword,
        first_name: guardianFirstName.trim() || undefined,
        last_name: guardianLastName.trim() || undefined,
        display_name: guardianDisplayName.trim() || undefined,
        email: guardianEmail.trim() || undefined,
      },
      relationship: relationship.trim() || 'Guardian',
      fee_item: {
        title: feeTitle.trim() || 'Tuition',
        amount: parsedFeeAmount.toFixed(2),
        due_date: feeDueDate.trim() || undefined,
      },
      programme: parsedProgramme,
      year: parsedYear,
      trimester: parsedTrimester,
      trimester_label: trimesterLabel.trim() || `Year ${parsedYear} Trimester ${parsedTrimester}`,
      cohort_year: parsedCohortYear,
    };

    await runGlobalAction(`enroll-student-${payload.student.username}`, async () => {
      const response = await enrollFamily(state.accessToken!, payload);
      setSuccess(
        `${response.detail} Approve ${response.student_request.username} and ${response.parent_request.username} below.`,
      );
      setStudentUsername('');
      setStudentPassword('Student@2026');
      setStudentFirstName('');
      setStudentLastName('');
      setStudentDisplayName('');
      setStudentEmail('');
      setGuardianUsername('');
      setGuardianPassword('Guardian@2026');
      setGuardianFirstName('');
      setGuardianLastName('');
      setGuardianDisplayName('');
      setGuardianEmail('');
      setRelationship('Guardian');
      setTrimesterLabel(`Year ${studyYear || '1'} Trimester ${studyTrimester || '1'}`);
      setFeeTitle('Tuition');
      setFeeAmount('30000');
      setFeeDueDate('');
    });
  };

  const approveProvision = async (requestId: number) => {
    if (!state.accessToken) {
      return;
    }
    await runGlobalAction(`approve-provision-${requestId}`, async () => {
      const response = await approveProvisionRequest(state.accessToken!, requestId);
      setSuccess(
        `Approved ${response.user.username}. Temporary password: ${response.temporary_password}.`,
      );
    });
  };

  const rejectProvision = async (requestId: number) => {
    if (!state.accessToken) {
      return;
    }
    await runGlobalAction(`reject-provision-${requestId}`, async () => {
      await rejectProvisionRequest(state.accessToken!, requestId, 'Rejected from records queue.');
      setSuccess(`Provision request #${requestId} rejected.`);
    });
  };

  const approveRegistration = async (registrationId: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    await runAction(`approve-registration-${registrationId}`, async () => {
      await approveHodRegistrations(state.accessToken!, [registrationId]);
      setSuccess(`Registration #${registrationId} approved.`);
    });
  };

  const rejectRegistration = async (registrationId: number) => {
    if (!selectedDepartmentId || !state.accessToken) {
      return;
    }
    await runAction(`reject-registration-${registrationId}`, async () => {
      await rejectHodRegistrations(state.accessToken!, [registrationId], 'Rejected from HOD review.');
      setSuccess(`Registration #${registrationId} rejected.`);
    });
  };

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId],
  );

  const filteredRegistrations = useMemo(() => {
    const yearValue = Number.parseInt(academicYear, 10);
    const trimesterValue = Number.parseInt(trimester, 10);
    return registrations
      .filter((item) => {
        if (selectedDepartmentId && item.department_id !== selectedDepartmentId) {
          return false;
        }
        if (!Number.isNaN(yearValue) && item.academic_year !== yearValue) {
          return false;
        }
        if (!Number.isNaN(trimesterValue) && item.trimester !== trimesterValue) {
          return false;
        }
        return true;
      })
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
  }, [academicYear, registrations, selectedDepartmentId, trimester]);

  const pendingRegistrations = useMemo(
    () => filteredRegistrations.filter((item) => item.status === 'pending_hod'),
    [filteredRegistrations],
  );

  const approvedRegistrations = useMemo(
    () => filteredRegistrations.filter((item) => item.status === 'approved'),
    [filteredRegistrations],
  );

  const rejectedRegistrations = useMemo(
    () => filteredRegistrations.filter((item) => item.status === 'rejected'),
    [filteredRegistrations],
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
          <Text style={styles.sectionTitle}>Student onboarding form</Text>
          <View style={styles.card}>
            <Text style={styles.subheading}>Student account</Text>
            <TextInput
              value={studentUsername}
              onChangeText={setStudentUsername}
              style={styles.input}
              placeholder="Student username (required)"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              value={studentPassword}
              onChangeText={setStudentPassword}
              style={styles.input}
              placeholder="Student password (required)"
              placeholderTextColor={palette.textSecondary}
              secureTextEntry
            />
            <TextInput
              value={studentFirstName}
              onChangeText={setStudentFirstName}
              style={styles.input}
              placeholder="Student first name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={studentLastName}
              onChangeText={setStudentLastName}
              style={styles.input}
              placeholder="Student last name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={studentDisplayName}
              onChangeText={setStudentDisplayName}
              style={styles.input}
              placeholder="Student display name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={studentEmail}
              onChangeText={setStudentEmail}
              style={styles.input}
              placeholder="Student email"
              placeholderTextColor={palette.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.subheading}>Guardian account</Text>
            <TextInput
              value={guardianUsername}
              onChangeText={setGuardianUsername}
              style={styles.input}
              placeholder="Guardian username (required)"
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              value={guardianPassword}
              onChangeText={setGuardianPassword}
              style={styles.input}
              placeholder="Guardian password (required)"
              placeholderTextColor={palette.textSecondary}
              secureTextEntry
            />
            <TextInput
              value={guardianFirstName}
              onChangeText={setGuardianFirstName}
              style={styles.input}
              placeholder="Guardian first name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={guardianLastName}
              onChangeText={setGuardianLastName}
              style={styles.input}
              placeholder="Guardian last name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={guardianDisplayName}
              onChangeText={setGuardianDisplayName}
              style={styles.input}
              placeholder="Guardian display name"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              style={styles.input}
              placeholder="Guardian email"
              placeholderTextColor={palette.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              value={relationship}
              onChangeText={setRelationship}
              style={styles.input}
              placeholder="Relationship (Guardian)"
              placeholderTextColor={palette.textSecondary}
            />

            <Text style={styles.subheading}>Academic + finance setup</Text>
            <TextInput
              value={programmeId}
              onChangeText={setProgrammeId}
              style={styles.input}
              placeholder="Programme ID (required)"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
            />
            {programmes.length ? (
              <Text style={styles.helper}>
                Available programmes: {programmes.map((item) => `${item.id}:${item.code}`).join(', ')}
              </Text>
            ) : null}
            <View style={styles.inlineInputRow}>
              <TextInput
                value={studyYear}
                onChangeText={setStudyYear}
                style={[styles.input, styles.inlineInput]}
                placeholder="Year"
                placeholderTextColor={palette.textSecondary}
                keyboardType="number-pad"
              />
              <TextInput
                value={studyTrimester}
                onChangeText={setStudyTrimester}
                style={[styles.input, styles.inlineInput]}
                placeholder="Trimester"
                placeholderTextColor={palette.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            <TextInput
              value={trimesterLabel}
              onChangeText={setTrimesterLabel}
              style={styles.input}
              placeholder="Trimester label"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={cohortYear}
              onChangeText={setCohortYear}
              style={styles.input}
              placeholder="Cohort year"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
            />
            <TextInput
              value={feeTitle}
              onChangeText={setFeeTitle}
              style={styles.input}
              placeholder="Fee title"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={feeAmount}
              onChangeText={setFeeAmount}
              style={styles.input}
              placeholder="Fee amount e.g. 30000"
              placeholderTextColor={palette.textSecondary}
              keyboardType="decimal-pad"
            />
            <TextInput
              value={feeDueDate}
              onChangeText={setFeeDueDate}
              style={styles.input}
              placeholder="Fee due date YYYY-MM-DD (optional)"
              placeholderTextColor={palette.textSecondary}
            />
            <TextInput
              value={recordsPasscode}
              onChangeText={setRecordsPasscode}
              style={styles.input}
              placeholder="Records passcode (required)"
              placeholderTextColor={palette.textSecondary}
              secureTextEntry
            />
            <VoiceButton
              label={actionKey?.startsWith('enroll-student-') ? 'Submitting onboarding...' : 'Create onboarding requests'}
              onPress={createStudentEnrollment}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Provisioning queue</Text>
          {pendingProvisionRequests.length ? (
            pendingProvisionRequests.map((item, index) => (
              <View key={`records-provision-${item.id}-${index}`} style={styles.card}>
                <Text style={styles.offeringTitle}>
                  {item.username} ({item.role})
                </Text>
                <Text style={styles.helper}>
                  Requested by {item.requested_by_detail?.display_name || item.requested_by_detail?.username || item.requested_by}
                </Text>
                <Text style={styles.helper}>Created {new Date(item.created_at).toLocaleString()}</Text>
                <View style={styles.buttonRow}>
                  <VoiceButton label="Approve" onPress={() => approveProvision(item.id)} />
                  <VoiceButton label="Reject" onPress={() => rejectProvision(item.id)} />
                </View>
              </View>
            ))
          ) : (
            <DashboardTile
              title="No pending provisioning requests"
              subtitle="Student and guardian onboarding requests will appear here."
              disabled
            />
          )}
        </View>

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
          <Text style={styles.sectionTitle}>Unit registration queue</Text>
          <DashboardTile
            title={`${filteredRegistrations.length} registrations in view`}
            subtitle={`${pendingRegistrations.length} pending HOD, ${approvedRegistrations.length} approved, ${rejectedRegistrations.length} rejected`}
            disabled
          />
          {filteredRegistrations.length ? (
            filteredRegistrations.slice(0, 20).map((registration) => (
              <DashboardTile
                key={`registration-${registration.id}`}
                title={`${registration.unit_code || 'Unit'} - ${registration.unit_title}`}
                subtitle={`${registration.student_name || registration.student_username || 'Student unavailable'} | ${registration.status.replaceAll('_', ' ')} | ${registration.academic_year} T${registration.trimester}`}
                statusColor={
                  registration.status === 'approved'
                    ? palette.success
                    : registration.status === 'rejected'
                      ? palette.danger
                      : palette.warning
                }
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No registrations for the selected term"
              subtitle="Student unit submissions will appear here for records tracking."
              disabled
            />
          )}
        </View>

        {badgeRole === 'hod' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HOD unit approval queue</Text>
            {pendingApprovals.length ? (
              pendingApprovals.map((registration) => (
                <View key={`hod-approval-${registration.id}`} style={styles.card}>
                  <Text style={styles.offeringTitle}>
                    {registration.unit_code || 'Unit'} - {registration.unit_title}
                  </Text>
                  <Text style={styles.helper}>
                    Student: {registration.student_name || registration.student_username || 'Student unavailable'}
                  </Text>
                  <Text style={styles.helper}>
                    Term: {registration.academic_year} / Trimester {registration.trimester}
                  </Text>
                  <View style={styles.buttonRow}>
                    <VoiceButton
                      label="Approve"
                      onPress={() => approveRegistration(registration.id)}
                    />
                    <VoiceButton
                      label="Reject"
                      onPress={() => rejectRegistration(registration.id)}
                    />
                  </View>
                </View>
              ))
            ) : (
              <DashboardTile
                title="No pending unit approvals"
                subtitle="Students who submit unit choices will appear here for HOD review."
                disabled
              />
            )}
          </View>
        ) : null}

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
  subheading: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: '700',
  },
  inlineInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineInput: {
    flex: 1,
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
