import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { Role } from '@app-types/roles';
import { roleLabels } from '@app-types/roles';
import {
  acknowledgeGovernanceRiskFlag,
  adminResetUserPassword,
  approveProvisionRequest,
  approveGovernanceRequest,
  createAdminUser,
  createParentStudentLink,
  enrollFamily,
  createGovernanceAlertPolicy,
  fetchGovernanceActivity,
  fetchGovernanceAlertPolicies,
  fetchGovernanceApprovalRequests,
  fetchGovernanceAuditCsv,
  fetchGovernanceAuditLogs,
  fetchParentStudentLinks,
  fetchGovernancePolicy,
  fetchGovernanceReportCsv,
  fetchGovernanceReports,
  fetchGovernanceRiskFlags,
  fetchGovernanceTabulations,
  fetchProgrammes,
  fetchProvisionRequests,
  fetchUsers,
  generateGovernanceReport,
  refreshGovernanceRiskFlags,
  rejectProvisionRequest,
  rejectGovernanceRequest,
  resolveGovernanceRiskFlag,
  updateGovernancePolicy,
  type ApiUser,
  type FamilyEnrollmentPayload,
  type GovernanceActivityItem,
  type GovernanceAlertPolicy,
  type GovernanceApprovalRequest,
  type GovernanceAuditLog,
  type GovernancePolicy,
  type GovernanceReportRecord,
  type GovernanceRiskFlag,
  type GovernanceTabulation,
  type ParentStudentLink,
  type ProgrammeSummary,
  type UserProvisionRequestSummary,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type AdminNav = NativeStackNavigationProp<RootStackParamList>;

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

const downloadCsvOnWeb = (filename: string, content: string) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('CSV download is currently available in the web admin view.');
  }
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

type AdminSummaryCardProps = {
  label: string;
  value: string | number;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: string;
};

type WorkspaceSection = 'monitoring' | 'users' | 'reports' | 'policy';

type WorkspaceNavButtonProps = {
  label: string;
  helper: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  count?: number;
  active: boolean;
  onPress: () => void;
};

const AdminSummaryCard: React.FC<AdminSummaryCardProps> = ({ label, value, detail, icon, tone }) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIconWrap, { backgroundColor: tone }]}>
      <MaterialCommunityIcons name={icon} size={22} color={palette.surface} />
    </View>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryDetail}>{detail}</Text>
  </View>
);

const WorkspaceNavButton: React.FC<WorkspaceNavButtonProps> = ({
  label,
  helper,
  icon,
  count,
  active,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.workspaceNavButton,
      active && styles.workspaceNavButtonActive,
      pressed && styles.workspaceNavButtonPressed,
    ]}
    onPress={onPress}
  >
    <View style={styles.workspaceNavTopRow}>
      <View style={[styles.workspaceNavIconWrap, active && styles.workspaceNavIconWrapActive]}>
        <MaterialCommunityIcons name={icon} size={20} color={active ? palette.surface : '#0F2557'} />
      </View>
      {typeof count === 'number' ? (
        <View style={[styles.workspaceNavCountPill, active && styles.workspaceNavCountPillActive]}>
          <Text style={[styles.workspaceNavCountText, active && styles.workspaceNavCountTextActive]}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
    <Text style={[styles.workspaceNavLabel, active && styles.workspaceNavLabelActive]}>{label}</Text>
    <Text style={[styles.workspaceNavHelper, active && styles.workspaceNavHelperActive]}>{helper}</Text>
  </Pressable>
);

export const AdminControlCenterScreen: React.FC = () => {
  const navigation = useNavigation<AdminNav>();
  const { state, logout, updatePreferences } = useAuth();
  const { width } = useWindowDimensions();
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('monitoring');
  const [tabulations, setTabulations] = useState<GovernanceTabulation[]>([]);
  const [reports, setReports] = useState<GovernanceReportRecord[]>([]);
  const [audits, setAudits] = useState<GovernanceAuditLog[]>([]);
  const [risks, setRisks] = useState<GovernanceRiskFlag[]>([]);
  const [approvals, setApprovals] = useState<GovernanceApprovalRequest[]>([]);
  const [activity, setActivity] = useState<GovernanceActivityItem[]>([]);
  const [policy, setPolicy] = useState<GovernancePolicy | null>(null);
  const [alertPolicies, setAlertPolicies] = useState<GovernanceAlertPolicy[]>([]);
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [parents, setParents] = useState<ApiUser[]>([]);
  const [students, setStudents] = useState<ApiUser[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeSummary[]>([]);
  const [provisionRequests, setProvisionRequests] = useState<UserProvisionRequestSummary[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentStudentLink[]>([]);
  const [parentUsername, setParentUsername] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('Guardian');
  const [recordsPasscode, setRecordsPasscode] = useState('');

  const [newUserRole, setNewUserRole] = useState<Role>('lecturer');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('Welcome@2026');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [resetPasswordUsername, setResetPasswordUsername] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const [reportType, setReportType] = useState('audit_summary');
  const [reportFormat, setReportFormat] = useState<'json' | 'csv'>('json');
  const [reportName, setReportName] = useState('');

  const [policyAuditDays, setPolicyAuditDays] = useState('365');
  const [policyChatDays, setPolicyChatDays] = useState('365');
  const [policyReportDays, setPolicyReportDays] = useState('365');
  const [policyBackupFrequency, setPolicyBackupFrequency] = useState('weekly');
  const [policyBackupLocation, setPolicyBackupLocation] = useState('');

  const [alertRole, setAlertRole] = useState('lecturer');
  const [alertMetric, setAlertMetric] = useState('unresolved_threads_48h');
  const [alertWarning, setAlertWarning] = useState('5');
  const [alertCritical, setAlertCritical] = useState('10');

  const currentYear = new Date().getFullYear();
  const [enrollStudentUsername, setEnrollStudentUsername] = useState('');
  const [enrollStudentPassword, setEnrollStudentPassword] = useState('Student@2026');
  const [enrollStudentFirstName, setEnrollStudentFirstName] = useState('');
  const [enrollStudentLastName, setEnrollStudentLastName] = useState('');
  const [enrollStudentDisplayName, setEnrollStudentDisplayName] = useState('');
  const [enrollStudentEmail, setEnrollStudentEmail] = useState('');

  const [enrollGuardianUsername, setEnrollGuardianUsername] = useState('');
  const [enrollGuardianPassword, setEnrollGuardianPassword] = useState('Guardian@2026');
  const [enrollGuardianFirstName, setEnrollGuardianFirstName] = useState('');
  const [enrollGuardianLastName, setEnrollGuardianLastName] = useState('');
  const [enrollGuardianDisplayName, setEnrollGuardianDisplayName] = useState('');
  const [enrollGuardianEmail, setEnrollGuardianEmail] = useState('');
  const [enrollRelationship, setEnrollRelationship] = useState('Guardian');

  const [enrollProgrammeId, setEnrollProgrammeId] = useState('');
  const [enrollYear, setEnrollYear] = useState('1');
  const [enrollTrimester, setEnrollTrimester] = useState('1');
  const [enrollTrimesterLabel, setEnrollTrimesterLabel] = useState('Year 1 Trimester 1');
  const [enrollCohortYear, setEnrollCohortYear] = useState(String(currentYear));
  const [enrollFeeTitle, setEnrollFeeTitle] = useState('Tuition');
  const [enrollFeeAmount, setEnrollFeeAmount] = useState('30000');
  const [enrollFeeDueDate, setEnrollFeeDueDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hydratePolicyDraft = (item: GovernancePolicy | null) => {
    if (!item) {
      return;
    }
    setPolicyAuditDays(String(item.audit_retention_days));
    setPolicyChatDays(String(item.chat_retention_days));
    setPolicyReportDays(String(item.report_retention_days));
    setPolicyBackupFrequency(item.backup_frequency || 'weekly');
    setPolicyBackupLocation(item.backup_location || '');
  };

  const loadDashboard = useCallback(
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
        const [
          tabulationsResponse,
          reportsResponse,
          auditsResponse,
          risksResponse,
          approvalsResponse,
          policyResponse,
          alertsResponse,
          activityResponse,
          allUserRows,
          parentUsers,
          studentUsers,
          programmeRows,
          requestRows,
          linkRows,
        ] = await Promise.all([
          fetchGovernanceTabulations(state.accessToken),
          fetchGovernanceReports(state.accessToken),
          fetchGovernanceAuditLogs(state.accessToken),
          fetchGovernanceRiskFlags(state.accessToken),
          fetchGovernanceApprovalRequests(state.accessToken, { status: 'pending' }),
          fetchGovernancePolicy(state.accessToken),
          fetchGovernanceAlertPolicies(state.accessToken),
          fetchGovernanceActivity(state.accessToken, 60),
          fetchUsers(state.accessToken),
          fetchUsers(state.accessToken, { role: 'parent' }),
          fetchUsers(state.accessToken, { role: 'student' }),
          fetchProgrammes(state.accessToken),
          fetchProvisionRequests(state.accessToken),
          fetchParentStudentLinks(state.accessToken),
        ]);
        setTabulations(tabulationsResponse.tabulations);
        setReports(reportsResponse);
        setAudits(auditsResponse);
        setRisks(risksResponse);
        setApprovals(approvalsResponse);
        setPolicy(policyResponse);
        setAlertPolicies(alertsResponse);
        setActivity(activityResponse.items);
        setAllUsers(allUserRows);
        setParents(parentUsers);
        setStudents(studentUsers);
        setProgrammes(programmeRows);
        setProvisionRequests(requestRows);
        setParentLinks(linkRows);
        hydratePolicyDraft(policyResponse);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load governance dashboard.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    if (!enrollProgrammeId && programmes.length) {
      setEnrollProgrammeId(String(programmes[0].id));
    }
  }, [enrollProgrammeId, programmes]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (!state.accessToken || actionKey) {
      return;
    }
    setActionKey(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await loadDashboard(true);
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

  const runUtilityAction = async (key: string, action: () => Promise<void>) => {
    if (!state.accessToken || actionKey) {
      return;
    }
    setActionKey(key);
    setError(null);
    setSuccess(null);
    try {
      await action();
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

  const resetNewUserForm = () => {
    setNewUserRole('lecturer');
    setNewUserUsername('');
    setNewUserPassword('Welcome@2026');
    setNewUserFirstName('');
    setNewUserLastName('');
    setNewUserDisplayName('');
    setNewUserEmail('');
  };

  const createUserAction = async () => {
    if (!state.accessToken) {
      return;
    }
    if (!newUserUsername.trim() || !newUserPassword.trim()) {
      setError('Username and password are required for the new account.');
      return;
    }
    await runAction(`create-user-${newUserUsername.trim().toLowerCase()}`, async () => {
      const created = await createAdminUser(state.accessToken!, {
        username: newUserUsername.trim().toLowerCase(),
        password: newUserPassword,
        role: newUserRole,
        email: newUserEmail.trim() || undefined,
        first_name: newUserFirstName.trim() || undefined,
        last_name: newUserLastName.trim() || undefined,
        display_name: newUserDisplayName.trim() || undefined,
      });
      setSuccess(
        `Created ${created.display_name || created.username} (${roleLabels[created.role] || created.role}).`,
      );
      resetNewUserForm();
    });
  };

  const resetUserPasswordAction = async (targetUser?: ApiUser) => {
    if (!state.accessToken) {
      return;
    }
    const normalizedUsername = resetPasswordUsername.trim().toLowerCase();
    const matchedUser =
      targetUser ??
      allUsers.find((item) => item.username.toLowerCase() === normalizedUsername);
    if (!matchedUser) {
      setError('Choose a valid user before resetting the password.');
      return;
    }

    await runAction(`reset-password-${matchedUser.id}`, async () => {
      const response = await adminResetUserPassword(state.accessToken!, {
        user_id: matchedUser.id,
        ...(resetPasswordValue.trim() ? { new_password: resetPasswordValue.trim() } : {}),
      });
      setSuccess(
        `Password reset for ${response.user.display_name || response.user.username}. Temporary password: ${response.temporary_password}.`,
      );
      setResetPasswordUsername(response.user.username);
      setResetPasswordValue('');
    });
  };

  const generateReportAction = async () => {
    if (!state.accessToken) {
      return;
    }
    await runAction('generate-report', async () => {
      const report = await generateGovernanceReport(state.accessToken!, {
        name: reportName.trim() || undefined,
        report_type: reportType.trim(),
        format: reportFormat,
      });
      setSuccess(
        `Report generated: ${report.name} (${report.rows_count} rows, ${report.format.toUpperCase()}).`,
      );
      setReportName('');
    });
  };

  const refreshRiskAction = async () => {
    if (!state.accessToken) {
      return;
    }
    await runAction('refresh-risk', async () => {
      const response = await refreshGovernanceRiskFlags(state.accessToken!);
      setSuccess(`Risk flags refreshed. ${response.created_count} new system flags created.`);
    });
  };

  const savePolicyAction = async () => {
    if (!state.accessToken) {
      return;
    }
    await runAction('save-policy', async () => {
      const updated = await updateGovernancePolicy(state.accessToken!, {
        audit_retention_days: Number.parseInt(policyAuditDays, 10) || 365,
        chat_retention_days: Number.parseInt(policyChatDays, 10) || 365,
        report_retention_days: Number.parseInt(policyReportDays, 10) || 365,
        backup_frequency: policyBackupFrequency.trim() || 'weekly',
        backup_location: policyBackupLocation.trim(),
      });
      setPolicy(updated);
      hydratePolicyDraft(updated);
      setSuccess('Governance policy updated.');
    });
  };

  const createAlertPolicyAction = async () => {
    if (!state.accessToken) {
      return;
    }
    await runAction('create-alert-policy', async () => {
      await createGovernanceAlertPolicy(state.accessToken!, {
        role: alertRole.trim(),
        metric_key: alertMetric.trim(),
        warning_threshold: Number.parseFloat(alertWarning) || 0,
        critical_threshold: Number.parseFloat(alertCritical) || 0,
        is_active: true,
      });
      setSuccess('Role alert policy created.');
    });
  };

  const downloadReportCsvAction = async (report: GovernanceReportRecord) => {
    if (!state.accessToken) {
      return;
    }
    await runUtilityAction(`download-report-${report.id}`, async () => {
      const csv = await fetchGovernanceReportCsv(state.accessToken!, report.id);
      downloadCsvOnWeb(`report-${report.id}.csv`, csv);
      setSuccess(`Downloaded CSV for report "${report.name}".`);
    });
  };

  const downloadAuditCsvAction = async () => {
    if (!state.accessToken) {
      return;
    }
    await runUtilityAction('download-audit-csv', async () => {
      const csv = await fetchGovernanceAuditCsv(state.accessToken!);
      downloadCsvOnWeb('audit-logs.csv', csv);
      setSuccess('Downloaded audit log CSV.');
    });
  };

  const pendingApprovals = useMemo(
    () => approvals.filter((item) => item.status === 'pending').slice(0, 8),
    [approvals],
  );
  const openRiskFlags = useMemo(() => risks.filter((item) => item.status !== 'resolved').slice(0, 8), [risks]);
  const recentReports = useMemo(() => reports.slice(0, 8), [reports]);
  const recentAudit = useMemo(() => audits.slice(0, 10), [audits]);
  const recentActivity = useMemo(() => activity.slice(0, 10), [activity]);
  const linkedParentIds = useMemo(
    () => new Set(parentLinks.map((link) => link.parent_detail.id)),
    [parentLinks],
  );
  const linkedStudentIds = useMemo(
    () => new Set(parentLinks.map((link) => link.student_detail.id)),
    [parentLinks],
  );
  const unlinkedParents = useMemo(
    () => parents.filter((parent) => !linkedParentIds.has(parent.id)),
    [linkedParentIds, parents],
  );
  const unlinkedStudents = useMemo(
    () => students.filter((student) => !linkedStudentIds.has(student.id)),
    [linkedStudentIds, students],
  );
  const pendingProvisionRequests = useMemo(
    () =>
      provisionRequests
        .filter((item) => item.status === 'pending')
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 12),
    [provisionRequests],
  );
  const resetPasswordMatches = useMemo(() => {
    const query = resetPasswordUsername.trim().toLowerCase();
    if (!query) {
      return allUsers.slice(0, 8);
    }
    return allUsers
      .filter((item) => {
        const haystack = `${item.username} ${item.display_name || ''} ${roleLabels[item.role] || item.role}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [allUsers, resetPasswordUsername]);
  const isDesktopWeb = Platform.OS === 'web' && width >= 1180;
  const isWideLayout = width >= 820;
  const totalUsers = useMemo(
    () => tabulations.find((item) => item.key === 'user_access')?.value ?? parents.length + students.length,
    [parents.length, students.length, tabulations],
  );
  const summaryCards = useMemo<AdminSummaryCardProps[]>(
    () => [
      {
        label: 'Users monitored',
        value: totalUsers,
        detail: 'All user activity and governance events in one place.',
        icon: 'account-group',
        tone: '#0057FF',
      },
      {
        label: 'Pending approvals',
        value: pendingApprovals.length,
        detail: 'Provisioning and sensitive actions waiting review.',
        icon: 'clipboard-check-outline',
        tone: '#FF7A00',
      },
      {
        label: 'Open risk flags',
        value: openRiskFlags.length,
        detail: 'Finance, communication, and academic risk signals.',
        icon: 'shield-alert-outline',
        tone: '#EB5757',
      },
      {
        label: 'Recent reports',
        value: recentReports.length,
        detail: 'Downloadable governance reports ready for export.',
        icon: 'file-chart-outline',
        tone: '#2ECC71',
      },
    ],
    [openRiskFlags.length, pendingApprovals.length, recentReports.length, totalUsers],
  );

  const creatableRoles = useMemo<Role[]>(
    () =>
      state.user?.role === 'superadmin'
        ? ['parent', 'lecturer', 'hod', 'finance', 'records', 'admin', 'superadmin', 'guest']
        : ['parent', 'lecturer', 'hod', 'finance', 'records', 'admin', 'guest'],
    [state.user?.role],
  );

  const workspaceItems = useMemo(
    () => [
      {
        key: 'monitoring' as WorkspaceSection,
        label: 'Monitoring',
        helper: 'Audit, approvals, risks, and live activity.',
        icon: 'radar' as const,
        count: pendingApprovals.length + openRiskFlags.length,
      },
      {
        key: 'users' as WorkspaceSection,
        label: 'Users',
        helper: 'Create accounts, onboard students, and link guardians.',
        icon: 'account-cog-outline' as const,
        count: pendingProvisionRequests.length,
      },
      {
        key: 'reports' as WorkspaceSection,
        label: 'Reports',
        helper: 'Generate exports and download report output.',
        icon: 'file-chart-outline' as const,
        count: recentReports.length,
      },
      {
        key: 'policy' as WorkspaceSection,
        label: 'Policy',
        helper: 'Retention rules, backups, and alert thresholds.',
        icon: 'shield-check-outline' as const,
        count: alertPolicies.length,
      },
    ],
    [
      alertPolicies.length,
      openRiskFlags.length,
      pendingApprovals.length,
      pendingProvisionRequests.length,
      recentReports.length,
    ],
  );

  const activeWorkspaceMeta = useMemo(
    () => workspaceItems.find((item) => item.key === workspaceSection) ?? workspaceItems[0],
    [workspaceItems, workspaceSection],
  );

  const linkParentStudentAction = async () => {
    if (!state.accessToken) {
      return;
    }
    const parent = parents.find(
      (item) => item.username.toLowerCase() === parentUsername.trim().toLowerCase(),
    );
    const student = students.find(
      (item) => item.username.toLowerCase() === studentUsername.trim().toLowerCase(),
    );
    if (!parent || !student) {
      setError('Enter valid parent and student usernames before linking.');
      return;
    }
    await runAction(`link-${parent.id}-${student.id}`, async () => {
      const response = await createParentStudentLink(state.accessToken!, {
        parent: parent.id,
        student: student.id,
        relationship: linkRelationship.trim() || 'Guardian',
        ...(recordsPasscode.trim() ? { records_passcode: recordsPasscode.trim() } : {}),
      });
      setSuccess(
        `Linked ${response.parent_detail.display_name || response.parent_detail.username} to ${response.student_detail.display_name || response.student_detail.username}.`,
      );
      setParentUsername('');
      setStudentUsername('');
      setRecordsPasscode('');
    });
  };

  const submitFamilyEnrollmentAction = async () => {
    if (!state.accessToken) {
      return;
    }
    const programme = Number.parseInt(enrollProgrammeId, 10);
    const year = Number.parseInt(enrollYear, 10);
    const trimester = Number.parseInt(enrollTrimester, 10);
    const cohortYear = Number.parseInt(enrollCohortYear, 10);
    const feeAmount = Number.parseFloat(enrollFeeAmount);

    if (!recordsPasscode.trim()) {
      setError('Records passcode is required to enroll a student.');
      return;
    }
    if (!enrollStudentUsername.trim() || !enrollGuardianUsername.trim()) {
      setError('Enter both student and guardian usernames.');
      return;
    }
    if (!enrollStudentPassword.trim() || !enrollGuardianPassword.trim()) {
      setError('Enter passwords for both student and guardian accounts.');
      return;
    }
    if (!programme || !year || !trimester || !cohortYear) {
      setError('Programme, year, trimester, and cohort year are required.');
      return;
    }
    if (Number.isNaN(feeAmount) || feeAmount <= 0) {
      setError('Fee amount must be greater than zero.');
      return;
    }

    const payload: FamilyEnrollmentPayload = {
      records_passcode: recordsPasscode.trim(),
      student: {
        username: enrollStudentUsername.trim().toLowerCase(),
        password: enrollStudentPassword,
        display_name: enrollStudentDisplayName.trim() || undefined,
        first_name: enrollStudentFirstName.trim() || undefined,
        last_name: enrollStudentLastName.trim() || undefined,
        email: enrollStudentEmail.trim() || undefined,
      },
      parent: {
        username: enrollGuardianUsername.trim().toLowerCase(),
        password: enrollGuardianPassword,
        display_name: enrollGuardianDisplayName.trim() || undefined,
        first_name: enrollGuardianFirstName.trim() || undefined,
        last_name: enrollGuardianLastName.trim() || undefined,
        email: enrollGuardianEmail.trim() || undefined,
      },
      relationship: enrollRelationship.trim() || 'Guardian',
      fee_item: {
        title: enrollFeeTitle.trim() || 'Tuition',
        amount: feeAmount.toFixed(2),
        due_date: enrollFeeDueDate.trim() || undefined,
      },
      programme,
      year,
      trimester,
      trimester_label: enrollTrimesterLabel.trim() || `Year ${year} Trimester ${trimester}`,
      cohort_year: cohortYear,
    };

    await runAction(`enroll-${payload.student.username}`, async () => {
      const result = await enrollFamily(state.accessToken!, payload);
      setSuccess(
        `${result.detail} Pending requests: ${result.student_request.username} and ${result.parent_request.username}. Approve both below to activate dashboards.`,
      );
      setEnrollStudentUsername('');
      setEnrollStudentPassword('Student@2026');
      setEnrollStudentFirstName('');
      setEnrollStudentLastName('');
      setEnrollStudentDisplayName('');
      setEnrollStudentEmail('');
      setEnrollGuardianUsername('');
      setEnrollGuardianPassword('Guardian@2026');
      setEnrollGuardianFirstName('');
      setEnrollGuardianLastName('');
      setEnrollGuardianDisplayName('');
      setEnrollGuardianEmail('');
      setEnrollRelationship('Guardian');
      setEnrollTrimesterLabel(`Year ${enrollYear || '1'} Trimester ${enrollTrimester || '1'}`);
      setEnrollFeeTitle('Tuition');
      setEnrollFeeAmount('30000');
      setEnrollFeeDueDate('');
    });
  };

  const approveProvisionAction = async (requestId: number) => {
    if (!state.accessToken) {
      return;
    }
    await runAction(`approve-provision-${requestId}`, async () => {
      const response = await approveProvisionRequest(state.accessToken!, requestId);
      setSuccess(
        `Approved ${response.user.username}. Temporary password: ${response.temporary_password}.`,
      );
    });
  };

  const rejectProvisionAction = async (requestId: number) => {
    if (!state.accessToken) {
      return;
    }
    await runAction(`reject-provision-${requestId}`, async () => {
      await rejectProvisionRequest(state.accessToken!, requestId, 'Rejected from admin enrollment queue.');
      setSuccess(`Provision request #${requestId} rejected.`);
    });
  };

  const monitoringWorkspace = (
    <View style={styles.workspaceStack}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tabulations (5+)</Text>
        <Text style={styles.sectionDescription}>
          Core monitoring counters for user access, governance events, and operational health.
        </Text>
        <View style={[styles.metricsCard, styles.metricGrid]}>
          {tabulations.map((metric) => (
            <View key={`tabulation-${metric.key}`} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending approvals</Text>
        <Text style={styles.sectionDescription}>
          Sensitive workflow requests that still need explicit review from admin or super admin.
        </Text>
        {pendingApprovals.length ? (
          pendingApprovals.map((approval) => (
            <View key={`approval-${approval.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>
                {approval.action_type} - {approval.target_user_detail?.display_name || approval.target_user || 'Unknown user'}
              </Text>
              <Text style={styles.helper}>
                Requested by {approval.requested_by_detail?.display_name || approval.requested_by} on{' '}
                {formatDateTime(approval.created_at)}
              </Text>
              <Text style={styles.helper}>Payload: {JSON.stringify(approval.payload)}</Text>
              <View style={styles.buttonRow}>
                <VoiceButton
                  label="Approve"
                  onPress={() =>
                    runAction(`approve-${approval.id}`, async () => {
                      await approveGovernanceRequest(state.accessToken!, approval.id);
                      setSuccess(`Approval #${approval.id} approved.`);
                    })
                  }
                />
                <VoiceButton
                  label="Reject"
                  onPress={() =>
                    runAction(`reject-${approval.id}`, async () => {
                      await rejectGovernanceRequest(state.accessToken!, approval.id, {
                        comment: 'Rejected by admin review.',
                      });
                      setSuccess(`Approval #${approval.id} rejected.`);
                    })
                  }
                />
              </View>
            </View>
          ))
        ) : (
          <DashboardTile title="No pending approvals" subtitle="Approval queue is clear." disabled />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk flags</Text>
        <Text style={styles.sectionDescription}>
          Current risk signals detected across finance, learning delivery, and communications.
        </Text>
        <View style={styles.buttonRow}>
          <VoiceButton
            label={actionKey === 'refresh-risk' ? 'Refreshing risk flags...' : 'Refresh risk flags'}
            onPress={refreshRiskAction}
          />
        </View>
        {openRiskFlags.length ? (
          openRiskFlags.map((flag) => (
            <View key={`risk-flag-${flag.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>
                {flag.flag_type} ({flag.severity}) - {flag.status}
              </Text>
              <Text style={styles.helper}>{flag.reason}</Text>
              <Text style={styles.helper}>Detected {formatDateTime(flag.detected_at)}</Text>
              <View style={styles.buttonRow}>
                <VoiceButton
                  label="Acknowledge"
                  onPress={() =>
                    runAction(`ack-risk-${flag.id}`, async () => {
                      await acknowledgeGovernanceRiskFlag(state.accessToken!, flag.id);
                      setSuccess(`Risk flag #${flag.id} acknowledged.`);
                    })
                  }
                />
                <VoiceButton
                  label="Resolve"
                  onPress={() =>
                    runAction(`resolve-risk-${flag.id}`, async () => {
                      await resolveGovernanceRiskFlag(
                        state.accessToken!,
                        flag.id,
                        'Resolved from admin control center',
                      );
                      setSuccess(`Risk flag #${flag.id} resolved.`);
                    })
                  }
                />
              </View>
            </View>
          ))
        ) : (
          <DashboardTile title="No open risk flags" subtitle="Risk monitor is currently clear." disabled />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Audit trail</Text>
        <Text style={styles.sectionDescription}>
          Immutable user and system activity with actor, target, request method, and download support.
        </Text>
        <View style={styles.buttonRow}>
          <VoiceButton
            label={actionKey === 'download-audit-csv' ? 'Downloading audit CSV...' : 'Download audit logs CSV'}
            onPress={downloadAuditCsvAction}
          />
        </View>
        {recentAudit.length ? (
          recentAudit.map((item) => (
            <DashboardTile
              key={`audit-${item.id}`}
              title={`${item.actor_user_detail?.display_name || item.actor_user_detail?.username || 'System'} | ${item.action}`}
              subtitle={`${formatDateTime(item.created_at)} | ${item.target_table}#${item.target_id || 'n/a'} | ${item.request_method || 'N/A'} ${item.request_path || ''}`.trim()}
              disabled
            />
          ))
        ) : (
          <DashboardTile
            title="No audit rows in scope"
            subtitle="Audit events will appear once users interact with APIs."
            disabled
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Unified activity timeline</Text>
        <Text style={styles.sectionDescription}>
          Combined view of reports, approvals, risks, and audit activity in one sequence.
        </Text>
        {recentActivity.length ? (
          recentActivity.map((item) => (
            <DashboardTile
              key={`activity-${item.id}`}
              title={`${item.kind.toUpperCase()} | ${item.title}`}
              subtitle={`${formatDateTime(item.timestamp)} | ${item.description}`}
              disabled
            />
          ))
        ) : (
          <DashboardTile title="No activity rows" subtitle="Activity timeline is empty." disabled />
        )}
      </View>
    </View>
  );

  const usersWorkspace = (
    <View style={styles.workspaceStack}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New staff or guardian account</Text>
        <Text style={styles.sectionDescription}>
          Create Guardian, staff, admin, or guest accounts directly from the web control center. Use student onboarding
          below for student dashboards.
        </Text>
        <View style={styles.card}>
          <Text style={styles.subheading}>Role</Text>
          <View style={styles.roleChipRow}>
            {creatableRoles.map((role) => (
              <Pressable
                key={`new-user-role-${role}`}
                accessibilityRole="button"
                accessibilityLabel={`Select ${roleLabels[role]}`}
                style={({ pressed }) => [
                  styles.roleChip,
                  newUserRole === role && styles.roleChipActive,
                  pressed && styles.roleChipPressed,
                ]}
                onPress={() => setNewUserRole(role)}
              >
                <Text style={[styles.roleChipText, newUserRole === role && styles.roleChipTextActive]}>
                  {roleLabels[role]}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={newUserUsername}
            onChangeText={setNewUserUsername}
            placeholder="Username (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={newUserPassword}
            onChangeText={setNewUserPassword}
            placeholder="Password (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <View style={styles.inlineInputRow}>
            <TextInput
              value={newUserFirstName}
              onChangeText={setNewUserFirstName}
              placeholder="First name"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, styles.inlineInput]}
            />
            <TextInput
              value={newUserLastName}
              onChangeText={setNewUserLastName}
              placeholder="Last name"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, styles.inlineInput]}
            />
          </View>
          <TextInput
            value={newUserDisplayName}
            onChangeText={setNewUserDisplayName}
            placeholder="Display name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={newUserEmail}
            onChangeText={setNewUserEmail}
            placeholder="Email"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey?.startsWith('create-user-') ? 'Creating account...' : 'Create account'}
              onPress={createUserAction}
            />
          </View>
          <Text style={styles.helper}>
            Admin can create admin accounts. Only super admin can create super admin accounts.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New student onboarding</Text>
        <Text style={styles.sectionDescription}>
          Student creation stays comprehensive here so programme, year, Guardian, and finance records are created in
          one controlled flow.
        </Text>
        <View style={styles.card}>
          <Text style={styles.subheading}>Student account</Text>
          <TextInput
            value={enrollStudentUsername}
            onChangeText={setEnrollStudentUsername}
            placeholder="Student username (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={enrollStudentPassword}
            onChangeText={setEnrollStudentPassword}
            placeholder="Student password (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <TextInput
            value={enrollStudentFirstName}
            onChangeText={setEnrollStudentFirstName}
            placeholder="Student first name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollStudentLastName}
            onChangeText={setEnrollStudentLastName}
            placeholder="Student last name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollStudentDisplayName}
            onChangeText={setEnrollStudentDisplayName}
            placeholder="Student display name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollStudentEmail}
            onChangeText={setEnrollStudentEmail}
            placeholder="Student email"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.subheading}>Guardian account</Text>
          <TextInput
            value={enrollGuardianUsername}
            onChangeText={setEnrollGuardianUsername}
            placeholder="Guardian username (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={enrollGuardianPassword}
            onChangeText={setEnrollGuardianPassword}
            placeholder="Guardian password (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <TextInput
            value={enrollGuardianFirstName}
            onChangeText={setEnrollGuardianFirstName}
            placeholder="Guardian first name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollGuardianLastName}
            onChangeText={setEnrollGuardianLastName}
            placeholder="Guardian last name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollGuardianDisplayName}
            onChangeText={setEnrollGuardianDisplayName}
            placeholder="Guardian display name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollGuardianEmail}
            onChangeText={setEnrollGuardianEmail}
            placeholder="Guardian email"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={enrollRelationship}
            onChangeText={setEnrollRelationship}
            placeholder="Relationship (Guardian)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />

          <Text style={styles.subheading}>Academic + finance setup</Text>
          <TextInput
            value={enrollProgrammeId}
            onChangeText={setEnrollProgrammeId}
            placeholder="Programme ID (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="number-pad"
          />
          {programmes.length ? (
            <Text style={styles.helper}>
              Available programmes: {programmes.map((item) => `${item.id}:${item.code}`).join(', ')}
            </Text>
          ) : null}
          <View style={styles.inlineInputRow}>
            <TextInput
              value={enrollYear}
              onChangeText={setEnrollYear}
              placeholder="Year"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, styles.inlineInput]}
              keyboardType="number-pad"
            />
            <TextInput
              value={enrollTrimester}
              onChangeText={setEnrollTrimester}
              placeholder="Trimester"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, styles.inlineInput]}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            value={enrollTrimesterLabel}
            onChangeText={setEnrollTrimesterLabel}
            placeholder="Trimester label"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollCohortYear}
            onChangeText={setEnrollCohortYear}
            placeholder="Cohort year"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            value={enrollFeeTitle}
            onChangeText={setEnrollFeeTitle}
            placeholder="Fee title (Tuition)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={enrollFeeAmount}
            onChangeText={setEnrollFeeAmount}
            placeholder="Fee amount e.g. 30000"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="decimal-pad"
          />
          <TextInput
            value={enrollFeeDueDate}
            onChangeText={setEnrollFeeDueDate}
            placeholder="Fee due date YYYY-MM-DD (optional)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={recordsPasscode}
            onChangeText={setRecordsPasscode}
            placeholder="Records passcode (required)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey?.startsWith('enroll-') ? 'Submitting enrollment...' : 'Create onboarding requests'}
              onPress={submitFamilyEnrollmentAction}
            />
          </View>
          <Text style={styles.helper}>
            Submit once, then approve the student and Guardian requests in the queue below.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reset dashboard login password</Text>
        <Text style={styles.sectionDescription}>
          Reset a user login from the admin workspace. The user will be required to change the temporary password
          after signing in.
        </Text>
        <View style={styles.card}>
          <TextInput
            value={resetPasswordUsername}
            onChangeText={setResetPasswordUsername}
            placeholder="Search username or display name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={resetPasswordValue}
            onChangeText={setResetPasswordValue}
            placeholder="Temporary password (leave blank to auto-generate)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey?.startsWith('reset-password-') ? 'Resetting password...' : 'Reset password'}
              onPress={() => resetUserPasswordAction()}
            />
          </View>
          <Text style={styles.helper}>
            Leave the temporary password blank if you want the system to generate one automatically.
          </Text>
        </View>
        {resetPasswordMatches.length ? (
          resetPasswordMatches.map((item) => (
            <View key={`reset-user-${item.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>{item.display_name || item.username}</Text>
              <Text style={styles.helper}>
                {item.username} | {roleLabels[item.role] || item.role}
              </Text>
              <View style={styles.buttonRow}>
                <VoiceButton
                  label={actionKey === `reset-password-${item.id}` ? 'Resetting...' : 'Reset this user'}
                  onPress={() => resetUserPasswordAction(item)}
                />
              </View>
            </View>
          ))
        ) : (
          <DashboardTile
            title="No matching users"
            subtitle="Search for a username or display name above."
            disabled
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provisioning queue</Text>
        <Text style={styles.sectionDescription}>
          Pending onboarding requests waiting to be approved so dashboards and credentials go live.
        </Text>
        {pendingProvisionRequests.length ? (
          pendingProvisionRequests.map((item) => (
            <View key={`provision-${item.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.username} ({item.role})
              </Text>
              <Text style={styles.helper}>
                Requested by {item.requested_by_detail?.display_name || item.requested_by_detail?.username || item.requested_by}
              </Text>
              <Text style={styles.helper}>Created {formatDateTime(item.created_at)}</Text>
              <View style={styles.buttonRow}>
                <VoiceButton label="Approve" onPress={() => approveProvisionAction(item.id)} />
                <VoiceButton label="Reject" onPress={() => rejectProvisionAction(item.id)} />
              </View>
            </View>
          ))
        ) : (
          <DashboardTile
            title="No pending provisioning requests"
            subtitle="New enrollment requests will appear here for approval."
            disabled
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guardian-student linking</Text>
        <Text style={styles.sectionDescription}>
          Link Guardian and student accounts that were created separately so their dashboards stay synchronized.
        </Text>
        <View style={[styles.metricsCard, styles.metricGrid]}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Guardians</Text>
            <Text style={styles.metricValue}>{parents.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Students</Text>
            <Text style={styles.metricValue}>{students.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Existing links</Text>
            <Text style={styles.metricValue}>{parentLinks.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Unlinked Guardians</Text>
            <Text style={styles.metricValue}>{unlinkedParents.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Unlinked students</Text>
            <Text style={styles.metricValue}>{unlinkedStudents.length}</Text>
          </View>
        </View>
        <View style={styles.card}>
          <TextInput
            value={parentUsername}
            onChangeText={setParentUsername}
            placeholder="Guardian username"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={studentUsername}
            onChangeText={setStudentUsername}
            placeholder="Student username"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={linkRelationship}
            onChangeText={setLinkRelationship}
            placeholder="Relationship (Guardian)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={recordsPasscode}
            onChangeText={setRecordsPasscode}
            placeholder="Records passcode (optional for admin)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey?.startsWith('link-') ? 'Linking...' : 'Link Guardian and student'}
              onPress={linkParentStudentAction}
            />
          </View>
        </View>
        {unlinkedParents.length ? (
          unlinkedParents.slice(0, 5).map((parent) => (
            <DashboardTile
              key={`unlinked-parent-${parent.id}`}
              title={`Unlinked Guardian: ${parent.display_name || parent.username}`}
              subtitle={parent.username}
              disabled
            />
          ))
        ) : (
          <DashboardTile title="All Guardian accounts linked" subtitle="No unlinked Guardian accounts found." disabled />
        )}
        {unlinkedStudents.length ? (
          unlinkedStudents.slice(0, 5).map((student) => (
            <DashboardTile
              key={`unlinked-student-${student.id}`}
              title={`Unlinked student: ${student.display_name || student.username}`}
              subtitle={student.username}
              disabled
            />
          ))
        ) : (
          <DashboardTile title="All student accounts linked" subtitle="No unlinked student accounts found." disabled />
        )}
      </View>
    </View>
  );

  const reportsWorkspace = (
    <View style={styles.workspaceStack}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Generate report</Text>
        <Text style={styles.sectionDescription}>
          Build governance reports in JSON or CSV, then download them directly from the web workspace.
        </Text>
        <View style={styles.card}>
          <TextInput
            value={reportName}
            onChangeText={setReportName}
            placeholder="Optional report name"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={reportType}
            onChangeText={setReportType}
            placeholder="report_type (e.g., audit_summary)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={reportFormat}
            onChangeText={(value) => setReportFormat(value.trim().toLowerCase() === 'csv' ? 'csv' : 'json')}
            placeholder="format (json or csv)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey === 'generate-report' ? 'Generating report...' : 'Generate report'}
              onPress={generateReportAction}
            />
          </View>
          <Text style={styles.helper}>Generated CSV files can be downloaded from the report list below.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent reports</Text>
        <Text style={styles.sectionDescription}>
          Generated report outputs with row counts, timestamps, and export actions.
        </Text>
        {recentReports.length ? (
          recentReports.map((report) => (
            <View key={`report-${report.id}`} style={styles.card}>
              <Text style={styles.cardTitle}>{report.name}</Text>
              <Text style={styles.helper}>
                {report.report_type} | {report.rows_count} rows | {formatDateTime(report.generated_at)}
              </Text>
              <View style={styles.buttonRow}>
                <VoiceButton
                  label={actionKey === `download-report-${report.id}` ? 'Downloading CSV...' : 'Download CSV'}
                  onPress={() => downloadReportCsvAction(report)}
                />
              </View>
            </View>
          ))
        ) : (
          <DashboardTile
            title="No reports generated yet"
            subtitle="Use the generator above to create your first report."
            disabled
          />
        )}
      </View>
    </View>
  );

  const policyWorkspace = (
    <View style={styles.workspaceStack}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data governance policy</Text>
        <Text style={styles.sectionDescription}>
          Retention windows and backup settings that control how long key platform data stays available.
        </Text>
        <View style={styles.card}>
          <TextInput
            value={policyAuditDays}
            onChangeText={setPolicyAuditDays}
            placeholder="Audit retention days"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            value={policyChatDays}
            onChangeText={setPolicyChatDays}
            placeholder="Chat retention days"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            value={policyReportDays}
            onChangeText={setPolicyReportDays}
            placeholder="Report retention days"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="number-pad"
          />
          <TextInput
            value={policyBackupFrequency}
            onChangeText={setPolicyBackupFrequency}
            placeholder="Backup frequency (daily/weekly/monthly)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={policyBackupLocation}
            onChangeText={setPolicyBackupLocation}
            placeholder="Backup location"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey === 'save-policy' ? 'Saving policy...' : 'Save governance policy'}
              onPress={savePolicyAction}
            />
          </View>
          {policy ? <Text style={styles.helper}>Last updated: {formatDateTime(policy.updated_at)}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role alert policies</Text>
        <Text style={styles.sectionDescription}>
          Threshold rules that tell the system when to raise warnings and critical alerts by role.
        </Text>
        <View style={styles.card}>
          <TextInput
            value={alertRole}
            onChangeText={setAlertRole}
            placeholder="Role (e.g., lecturer)"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={alertMetric}
            onChangeText={setAlertMetric}
            placeholder="Metric key"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={alertWarning}
            onChangeText={setAlertWarning}
            placeholder="Warning threshold"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="decimal-pad"
          />
          <TextInput
            value={alertCritical}
            onChangeText={setAlertCritical}
            placeholder="Critical threshold"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            keyboardType="decimal-pad"
          />
          <View style={styles.buttonRow}>
            <VoiceButton
              label={actionKey === 'create-alert-policy' ? 'Saving alert policy...' : 'Create alert policy'}
              onPress={createAlertPolicyAction}
            />
          </View>
        </View>
        {alertPolicies.length ? (
          alertPolicies.slice(0, 8).map((alert) => (
            <DashboardTile
              key={`alert-policy-${alert.id}`}
              title={`${alert.role} | ${alert.metric_key}`}
              subtitle={`Warn ${alert.warning_threshold} | Critical ${alert.critical_threshold}`}
              disabled
            />
          ))
        ) : (
          <DashboardTile
            title="No alert policies"
            subtitle="Create a role-based alert policy to activate threshold tracking."
            disabled
          />
        )}
      </View>
    </View>
  );

  const activeWorkspace =
    workspaceSection === 'users'
      ? usersWorkspace
      : workspaceSection === 'reports'
        ? reportsWorkspace
        : workspaceSection === 'policy'
          ? policyWorkspace
          : monitoringWorkspace;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading admin control center...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundGlowOne} />
      <View pointerEvents="none" style={styles.backgroundGlowTwo} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />
        }
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Admin'}
          greeting="Admin control center"
          rightAccessory={<RoleBadge role={state.user?.role === 'superadmin' ? 'superadmin' : 'admin'} />}
        />

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Governance command view for reports, audit trail, approvals, risk controls, and retention policies.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Governance action failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Update completed</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={[styles.heroTopRow, isWideLayout && styles.heroTopRowWide]}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Platform governance workspace</Text>
              <Text style={styles.heroTitle}>Command the admin center with less scrolling.</Text>
              <Text style={styles.heroText}>
                Monitor users, export logs, approve workflows, and manage onboarding from a cleaner desktop control surface.
              </Text>
            </View>
            <View style={[styles.heroActionStack, isWideLayout && styles.heroActionRow]}>
              <VoiceButton
                label={actionKey === 'download-audit-csv' ? 'Downloading audit CSV...' : 'Export audit logs'}
                onPress={downloadAuditCsvAction}
              />
              <VoiceButton
                label={actionKey === 'refresh-risk' ? 'Refreshing risks...' : 'Refresh risk flags'}
                onPress={refreshRiskAction}
              />
              <VoiceButton
                label="Refresh dashboard"
                onPress={() => loadDashboard(true)}
              />
            </View>
          </View>
          <View style={[styles.summaryGrid, isWideLayout && styles.summaryGridWide]}>
            {summaryCards.map((item) => (
              <AdminSummaryCard
                key={item.label}
                label={item.label}
                value={item.value}
                detail={item.detail}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </View>
        </View>

        <View style={[styles.workspaceShell, isDesktopWeb && styles.workspaceShellDesktop]}>
          <View style={[styles.workspaceNav, isDesktopWeb ? styles.workspaceNavDesktop : styles.workspaceNavMobile]}>
            <Text style={styles.workspaceRailTitle}>Workspace</Text>
            <Text style={styles.workspaceRailHelper}>Choose a control surface and keep the rest out of the way.</Text>
            <View style={styles.workspaceNavList}>
              {workspaceItems.map((item) => (
                <WorkspaceNavButton
                  key={item.key}
                  label={item.label}
                  helper={item.helper}
                  icon={item.icon}
                  count={item.count}
                  active={workspaceSection === item.key}
                  onPress={() => setWorkspaceSection(item.key)}
                />
              ))}
            </View>
          </View>

          <View style={styles.workspaceMain}>
            <View style={styles.workspaceHeaderCard}>
              <Text style={styles.workspaceHeaderEyebrow}>Active area</Text>
              <Text style={styles.workspaceHeaderTitle}>{activeWorkspaceMeta.label}</Text>
              <Text style={styles.workspaceHeaderText}>{activeWorkspaceMeta.helper}</Text>
            </View>
            {activeWorkspace}
          </View>
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Refresh dashboard', onPress: () => loadDashboard(true) },
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
  backgroundGlowOne: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#D6E4FF',
    opacity: 0.75,
  },
  backgroundGlowTwo: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#FFE3CC',
    opacity: 0.7,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: spacing.md,
    padding: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 1480,
    alignSelf: 'center',
  },
  introCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#D7E4FF',
  },
  introText: {
    ...typography.helper,
    color: '#244B8A',
  },
  heroCard: {
    backgroundColor: '#0F2557',
    borderRadius: 32,
    padding: spacing.xl,
    gap: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#0B1C42',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 5,
  },
  heroTopRow: {
    gap: spacing.lg,
  },
  heroTopRowWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
    maxWidth: 720,
  },
  heroEyebrow: {
    ...typography.helper,
    color: '#9CC1FF',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    ...typography.headingXL,
    color: palette.surface,
  },
  heroText: {
    ...typography.body,
    color: '#D8E4FF',
    maxWidth: 720,
  },
  heroActionStack: {
    gap: spacing.sm,
  },
  heroActionRow: {
    width: 360,
    justifyContent: 'flex-start',
  },
  summaryGrid: {
    gap: spacing.md,
  },
  summaryGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryCard: {
    flexBasis: '23%',
    minWidth: 220,
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typography.helper,
    color: '#C8D9FF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    ...typography.headingL,
    color: palette.surface,
  },
  summaryDetail: {
    ...typography.helper,
    color: '#D8E4FF',
  },
  workspaceShell: {
    gap: spacing.lg,
  },
  workspaceShellDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  workspaceNav: {
    gap: spacing.md,
  },
  workspaceNavDesktop: {
    width: 290,
  },
  workspaceNavMobile: {
    width: '100%',
  },
  workspaceRailTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  workspaceRailHelper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  workspaceNavList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  workspaceNavButton: {
    minWidth: 180,
    flexBasis: 0,
    flexGrow: 1,
    backgroundColor: '#F4F7FD',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DCE6F6',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  workspaceNavButtonActive: {
    backgroundColor: '#0F2557',
    borderColor: '#0F2557',
  },
  workspaceNavButtonPressed: {
    opacity: 0.9,
  },
  workspaceNavTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  workspaceNavIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE8FF',
  },
  workspaceNavIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  workspaceNavCountPill: {
    minWidth: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: '#E7EDF7',
  },
  workspaceNavCountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  workspaceNavCountText: {
    ...typography.helper,
    color: '#0F2557',
    textAlign: 'center',
  },
  workspaceNavCountTextActive: {
    color: palette.surface,
  },
  workspaceNavLabel: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: '700',
  },
  workspaceNavLabelActive: {
    color: palette.surface,
  },
  workspaceNavHelper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  workspaceNavHelperActive: {
    color: '#D8E4FF',
  },
  workspaceMain: {
    flex: 1,
    gap: spacing.lg,
  },
  workspaceHeaderCard: {
    backgroundColor: '#F7F9FC',
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F3',
    gap: spacing.xs,
  },
  workspaceHeaderEyebrow: {
    ...typography.helper,
    color: '#45608B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  workspaceHeaderTitle: {
    ...typography.headingL,
    color: palette.textPrimary,
  },
  workspaceHeaderText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  workspaceStack: {
    gap: spacing.lg,
  },
  workspaceGrid: {
    gap: spacing.lg,
  },
  workspaceGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  workspaceColumn: {
    gap: spacing.lg,
  },
  workspaceColumnPrimary: {
    flex: 1.05,
  },
  workspaceColumnSecondary: {
    flex: 0.95,
  },
  section: {
    gap: spacing.md,
    backgroundColor: '#F3F7FF',
    borderRadius: 28,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#DCE8FF',
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  sectionDescription: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E8ECF5',
    shadowColor: '#13203B',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  cardTitle: {
    ...typography.body,
    color: palette.textPrimary,
  },
  subheading: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: '700',
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
  inlineInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineInput: {
    flex: 1,
  },
  roleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#EAF0FA',
    borderWidth: 1,
    borderColor: '#D4DDEA',
  },
  roleChipActive: {
    backgroundColor: '#0F2557',
    borderColor: '#0F2557',
  },
  roleChipPressed: {
    opacity: 0.88,
  },
  roleChipText: {
    ...typography.helper,
    color: '#0F2557',
    fontWeight: '700',
  },
  roleChipTextActive: {
    color: palette.surface,
  },
  metricsCard: {
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    padding: 0,
    gap: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCard: {
    minWidth: 180,
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#E3EAF8',
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
    fontWeight: '700',
  },
  buttonRow: {
    gap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  helper: {
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
