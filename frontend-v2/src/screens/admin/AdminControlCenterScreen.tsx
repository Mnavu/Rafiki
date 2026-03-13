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
  acknowledgeGovernanceRiskFlag,
  approveGovernanceRequest,
  createParentStudentLink,
  createGovernanceAlertPolicy,
  fetchGovernanceActivity,
  fetchGovernanceAlertPolicies,
  fetchGovernanceApprovalRequests,
  fetchGovernanceAuditLogs,
  fetchParentStudentLinks,
  fetchGovernancePolicy,
  fetchGovernanceReports,
  fetchGovernanceRiskFlags,
  fetchGovernanceTabulations,
  fetchUsers,
  generateGovernanceReport,
  refreshGovernanceRiskFlags,
  rejectGovernanceRequest,
  resolveGovernanceRiskFlag,
  updateGovernancePolicy,
  type ApiUser,
  type GovernanceActivityItem,
  type GovernanceAlertPolicy,
  type GovernanceApprovalRequest,
  type GovernanceAuditLog,
  type GovernancePolicy,
  type GovernanceReportRecord,
  type GovernanceRiskFlag,
  type GovernanceTabulation,
  type ParentStudentLink,
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

export const AdminControlCenterScreen: React.FC = () => {
  const navigation = useNavigation<AdminNav>();
  const { state, logout, updatePreferences } = useAuth();
  const [tabulations, setTabulations] = useState<GovernanceTabulation[]>([]);
  const [reports, setReports] = useState<GovernanceReportRecord[]>([]);
  const [audits, setAudits] = useState<GovernanceAuditLog[]>([]);
  const [risks, setRisks] = useState<GovernanceRiskFlag[]>([]);
  const [approvals, setApprovals] = useState<GovernanceApprovalRequest[]>([]);
  const [activity, setActivity] = useState<GovernanceActivityItem[]>([]);
  const [policy, setPolicy] = useState<GovernancePolicy | null>(null);
  const [alertPolicies, setAlertPolicies] = useState<GovernanceAlertPolicy[]>([]);
  const [parents, setParents] = useState<ApiUser[]>([]);
  const [students, setStudents] = useState<ApiUser[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentStudentLink[]>([]);
  const [parentUsername, setParentUsername] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [linkRelationship, setLinkRelationship] = useState('Guardian');
  const [recordsPasscode, setRecordsPasscode] = useState('');

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
          parentUsers,
          studentUsers,
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
          fetchUsers(state.accessToken, { role: 'parent' }),
          fetchUsers(state.accessToken, { role: 'student' }),
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
        setParents(parentUsers);
        setStudents(studentUsers);
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tabulations (5+)</Text>
          <View style={styles.metricsCard}>
            {tabulations.map((metric, index) => (
              <View key={`tabulation-${metric.key}-${index}`} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parent-student linking</Text>
          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Parents</Text>
              <Text style={styles.metricValue}>{parents.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Students</Text>
              <Text style={styles.metricValue}>{students.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Existing links</Text>
              <Text style={styles.metricValue}>{parentLinks.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Unlinked parents</Text>
              <Text style={styles.metricValue}>{unlinkedParents.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Unlinked students</Text>
              <Text style={styles.metricValue}>{unlinkedStudents.length}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <TextInput
              value={parentUsername}
              onChangeText={setParentUsername}
              placeholder="Parent username (e.g. parent1)"
              placeholderTextColor={palette.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={studentUsername}
              onChangeText={setStudentUsername}
              placeholder="Student username (e.g. student1)"
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
            <VoiceButton
              label={actionKey?.startsWith('link-') ? 'Linking...' : 'Link parent and student'}
              onPress={linkParentStudentAction}
            />
          </View>
          {unlinkedParents.length ? (
            unlinkedParents.slice(0, 5).map((parent, index) => (
              <DashboardTile
                key={`unlinked-parent-${parent.id}-${index}`}
                title={`Unlinked parent: ${parent.display_name || parent.username}`}
                subtitle={parent.username}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="All parent accounts linked"
              subtitle="No unlinked parent accounts found."
              disabled
            />
          )}
          {unlinkedStudents.length ? (
            unlinkedStudents.slice(0, 5).map((student, index) => (
              <DashboardTile
                key={`unlinked-student-${student.id}-${index}`}
                title={`Unlinked student: ${student.display_name || student.username}`}
                subtitle={student.username}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="All student accounts linked"
              subtitle="No unlinked student accounts found."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate report</Text>
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
            <VoiceButton
              label={actionKey === 'generate-report' ? 'Generating report...' : 'Generate report'}
              onPress={generateReportAction}
            />
          </View>
          {recentReports.length ? (
            recentReports.map((report, index) => (
              <DashboardTile
                key={`report-${report.id}-${index}`}
                title={report.name}
                subtitle={`${report.report_type} | ${report.rows_count} rows | ${formatDateTime(report.generated_at)}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No reports generated yet"
              subtitle="Use the generator above to create your first report."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending approvals</Text>
          {pendingApprovals.length ? (
              pendingApprovals.map((approval, index) => (
              <View key={`approval-${approval.id}-${index}`} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {approval.action_type} - {approval.target_user_detail?.display_name || approval.target_user || 'Unknown user'}
                </Text>
                <Text style={styles.helper}>
                  Requested by {approval.requested_by_detail?.display_name || approval.requested_by} on {formatDateTime(approval.created_at)}
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
          <VoiceButton
            label={actionKey === 'refresh-risk' ? 'Refreshing risk flags...' : 'Refresh risk flags'}
            onPress={refreshRiskAction}
          />
          {openRiskFlags.length ? (
              openRiskFlags.map((flag, index) => (
              <View key={`risk-flag-${flag.id}-${index}`} style={styles.card}>
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
          {recentAudit.length ? (
              recentAudit.map((item, index) => (
                <DashboardTile
                key={`audit-${item.id}-${index}`}
                title={`${item.action} | ${item.target_table}`}
                subtitle={`${formatDateTime(item.created_at)} | target ${item.target_id || 'n/a'}`}
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
          {recentActivity.length ? (
              recentActivity.map((item, index) => (
                <DashboardTile
                key={`activity-${item.id}-${index}`}
                title={`${item.kind.toUpperCase()} | ${item.title}`}
                subtitle={`${formatDateTime(item.timestamp)} | ${item.description}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile title="No activity rows" subtitle="Activity timeline is empty." disabled />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data governance policy</Text>
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
            <VoiceButton
              label={actionKey === 'save-policy' ? 'Saving policy...' : 'Save governance policy'}
              onPress={savePolicyAction}
            />
            {policy ? (
              <Text style={styles.helper}>Last updated: {formatDateTime(policy.updated_at)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role alert policies</Text>
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
            <VoiceButton
              label={actionKey === 'create-alert-policy' ? 'Saving alert policy...' : 'Create alert policy'}
              onPress={createAlertPolicyAction}
            />
          </View>
          {alertPolicies.length ? (
              alertPolicies.slice(0, 8).map((alert, index) => (
                <DashboardTile
                key={`alert-policy-${alert.id}-${index}`}
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
  },
  introCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  introText: {
    ...typography.helper,
    color: palette.textSecondary,
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
  cardTitle: {
    ...typography.body,
    color: palette.textPrimary,
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
  buttonRow: {
    gap: spacing.sm,
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
