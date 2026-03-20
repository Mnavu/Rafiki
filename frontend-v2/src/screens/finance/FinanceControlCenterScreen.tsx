import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import {
  fetchFinancePayments,
  fetchStudentFinanceStatuses,
  openFinanceRegistration,
  recordFinancePayment,
  type FinanceStatusSummary,
  type PaymentSummary,
} from '@services/api';
import { palette, spacing, typography } from '@theme/index';

const formatCurrency = (value: string): string => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(parsed);
};

const parseAmount = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const paymentPercent = (row: FinanceStatusSummary): number => {
  const due = parseAmount(row.total_due);
  const paid = parseAmount(row.total_paid);
  if (due <= 0) {
    return 100;
  }
  return Math.min(100, (paid / due) * 100);
};

const clearanceLabel = (row: FinanceStatusSummary): string => {
  if (row.clearance_status === 'cleared_for_registration') {
    return 'Cleared for unit registration';
  }
  if (parseAmount(row.total_paid) <= 0) {
    return 'Pending finance approval';
  }
  return 'Blocked until payment reaches 60%';
};

export const FinanceControlCenterScreen: React.FC = () => {
  const { state, logout, updatePreferences } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const [statuses, setStatuses] = useState<FinanceStatusSummary[]>([]);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSectionY, setSelectedSectionY] = useState(0);

  const loadFinance = useCallback(
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
        const [statusRows, paymentRows] = await Promise.all([
          fetchStudentFinanceStatuses(state.accessToken),
          fetchFinancePayments(state.accessToken),
        ]);
        const sortedStatuses = [...statusRows].sort((left, right) => {
          const rightPriority =
            right.clearance_status === 'blocked' ? 0 : right.clearance_status === 'cleared_for_registration' ? 1 : 2;
          const leftPriority =
            left.clearance_status === 'blocked' ? 0 : left.clearance_status === 'cleared_for_registration' ? 1 : 2;
          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        });
        const sortedPayments = [...paymentRows].sort(
          (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );
        setStatuses(sortedStatuses);
        setPayments(sortedPayments);
        setSelectedStatusId((current) => {
          if (current && sortedStatuses.some((item) => item.id === current)) {
            return current;
          }
          return sortedStatuses[0]?.id ?? null;
        });
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load finance control center.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadFinance(false);
  }, [loadFinance]);

  const selectedStatus = useMemo(
    () => statuses.find((item) => item.id === selectedStatusId) ?? null,
    [selectedStatusId, statuses],
  );

  const filteredStatuses = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) {
      return statuses.slice(0, 12);
    }
    return statuses
      .filter((item) => {
        const name = `${item.student_name || ''} ${item.student_username || ''} ${item.programme_name || ''}`.toLowerCase();
        return name.includes(query);
      })
      .slice(0, 12);
  }, [statuses, studentQuery]);

  const chooseStudent = useCallback(
    (statusId: number, scrollToForm = false) => {
      setSelectedStatusId(statusId);
      setError(null);
      setSuccess(null);
      if (scrollToForm) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: Math.max(selectedSectionY - spacing.lg, 0),
            animated: true,
          });
        });
      }
    },
    [selectedSectionY],
  );

  const pendingStatuses = useMemo(
    () =>
      statuses.filter(
        (item) => item.clearance_status === 'blocked' && parseAmount(item.total_paid) <= 0,
      ),
    [statuses],
  );

  const blockedStatuses = useMemo(
    () =>
      statuses.filter(
        (item) => item.clearance_status === 'blocked' && parseAmount(item.total_paid) > 0,
      ),
    [statuses],
  );

  const readyToClear = useMemo(
    () =>
      statuses.filter(
        (item) =>
          item.clearance_status === 'blocked' &&
          paymentPercent(item) >= 60,
      ),
    [statuses],
  );

  const clearedStatuses = useMemo(
    () => statuses.filter((item) => item.clearance_status === 'cleared_for_registration'),
    [statuses],
  );

  const selectedRecentPayments = useMemo(() => {
    if (!selectedStatus?.student) {
      return [];
    }
    return payments.filter((item) => item.student === selectedStatus.student).slice(0, 5);
  }, [payments, selectedStatus?.student]);

  const recordPaymentAction = useCallback(async () => {
    if (!state.accessToken || !selectedStatus) {
      return;
    }
    if (!amount.trim()) {
      setError('Enter the amount paid first.');
      return;
    }
    setActionKey(`payment-${selectedStatus.id}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await recordFinancePayment(state.accessToken, selectedStatus.id, {
        amount: amount.trim(),
        method: method.trim(),
        ref: reference.trim(),
      });
      setSuccess(
        `${response.finance_status.student_name || response.finance_status.student_username || 'Student'} payment recorded. Paid ${response.percentage_paid.toFixed(0)}% so far.`,
      );
      setAmount('');
      setReference('');
      await loadFinance(true);
      setSelectedStatusId(response.finance_status.id);
    } catch (actionError) {
      if (actionError instanceof Error) {
        setError(actionError.message);
      } else {
        setError('Unable to record payment.');
      }
    } finally {
      setActionKey(null);
    }
  }, [amount, loadFinance, method, reference, selectedStatus, state.accessToken]);

  const clearStudentAction = useCallback(async (targetStatus?: FinanceStatusSummary) => {
    const activeStatus = targetStatus ?? selectedStatus;
    if (!state.accessToken || !activeStatus) {
      return;
    }
    setActionKey(`clear-${activeStatus.id}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await openFinanceRegistration(state.accessToken, activeStatus.id);
      setSuccess(
        `${activeStatus.student_name || activeStatus.student_username || 'Student'} cleared for registration at ${response.percentage_paid.toFixed(0)}% payment.`,
      );
      await loadFinance(true);
      setSelectedStatusId(activeStatus.id);
    } catch (actionError) {
      if (actionError instanceof Error) {
        setError(actionError.message);
      } else {
        setError('Unable to clear student for registration.');
      }
    } finally {
      setActionKey(null);
    }
  }, [loadFinance, selectedStatus, state.accessToken]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading finance control center...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFinance(true)} />}
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Finance'}
          greeting="Finance control center"
          rightAccessory={<RoleBadge role="finance" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Finance workflow error</Text>
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
          <Text style={styles.sectionTitle}>Finance overview</Text>
          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Pending finance approval</Text>
              <Text style={styles.metricValue}>{pendingStatuses.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Still blocked</Text>
              <Text style={styles.metricValue}>{blockedStatuses.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Ready to clear</Text>
              <Text style={styles.metricValue}>{readyToClear.length}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Already cleared</Text>
              <Text style={styles.metricValue}>{clearedStatuses.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose student for finance action</Text>
          <TextInput
            value={studentQuery}
            onChangeText={setStudentQuery}
            style={styles.input}
            placeholder="Search by student name, username, or programme"
            placeholderTextColor={palette.textSecondary}
          />
          {filteredStatuses.length ? (
            filteredStatuses.map((item) => (
              <DashboardTile
                key={`finance-picker-${item.id}`}
                title={`${item.student_name || item.student_username || 'Student'}${selectedStatusId === item.id ? ' | Selected' : ''}`}
                subtitle={`${item.programme_name || 'Programme pending'} | ${clearanceLabel(item)} | ${paymentPercent(item).toFixed(0)}% paid`}
                onPress={() => chooseStudent(item.id, true)}
                statusColor={selectedStatusId === item.id ? palette.primary : undefined}
              />
            ))
          ) : (
            <DashboardTile
              title="No matching student"
              subtitle="Try another name, username, or programme."
              disabled
            />
          )}
        </View>

        <View
          style={styles.section}
          onLayout={({ nativeEvent }) => setSelectedSectionY(nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>Record payment and clearance</Text>
          {selectedStatus ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Recording for {selectedStatus.student_name || selectedStatus.student_username || 'Student'}
              </Text>
              <Text style={styles.helper}>
                {selectedStatus.programme_name || 'Programme pending'} | Year {selectedStatus.study_year ?? '-'} | {selectedStatus.trimester_label || `Trimester ${selectedStatus.trimester}`}
              </Text>
              <Text style={styles.helper}>
                {clearanceLabel(selectedStatus)}
              </Text>
              <Text style={styles.helper}>
                Paid {formatCurrency(selectedStatus.total_paid)} of {formatCurrency(selectedStatus.total_due)} ({paymentPercent(selectedStatus).toFixed(0)}%)
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                style={styles.input}
                placeholder="Amount paid"
                placeholderTextColor={palette.textSecondary}
                keyboardType="decimal-pad"
              />
              <TextInput
                value={method}
                onChangeText={setMethod}
                style={styles.input}
                placeholder="Payment method"
                placeholderTextColor={palette.textSecondary}
              />
              <TextInput
                value={reference}
                onChangeText={setReference}
                style={styles.input}
                placeholder="Reference or receipt number"
                placeholderTextColor={palette.textSecondary}
              />
              <View style={styles.buttonRow}>
                <VoiceButton
                  label={actionKey === `payment-${selectedStatus.id}` ? 'Recording payment...' : 'Record payment'}
                  onPress={recordPaymentAction}
                />
                <VoiceButton
                  label={actionKey === `clear-${selectedStatus.id}` ? 'Clearing...' : 'Clear for units'}
                  onPress={paymentPercent(selectedStatus) >= 60 ? clearStudentAction : undefined}
                />
              </View>
              <Text style={styles.helper}>
                Choose the student above, then record the payment here. A student can only be cleared after at least 60% of the fees are recorded.
              </Text>
            </View>
          ) : (
            <DashboardTile
              title="Select a student first"
              subtitle="Use the student chooser above to decide whose payment or clearance you want to process."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New students waiting finance approval</Text>
          {pendingStatuses.length ? (
            pendingStatuses.slice(0, 10).map((item) => (
              <View key={`pending-finance-${item.id}`} style={styles.actionCard}>
                <DashboardTile
                  title={`${item.student_name || item.student_username || 'Student'} | Pending approval`}
                  subtitle={`${item.programme_name || 'Programme pending'} | Due ${formatCurrency(item.total_due)} | Select to record first payment`}
                  onPress={() => chooseStudent(item.id, true)}
                  statusColor={selectedStatusId === item.id ? palette.primary : palette.warning}
                />
                <View style={styles.inlineButtons}>
                  <VoiceButton
                    label="Review"
                    size="compact"
                    style={styles.inlineButton}
                    onPress={() => chooseStudent(item.id, true)}
                  />
                </View>
              </View>
            ))
          ) : (
            <DashboardTile
              title="No new students waiting"
              subtitle="Newly onboarded students with zero payment will appear here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocked students</Text>
          {blockedStatuses.length ? (
            blockedStatuses.slice(0, 10).map((item) => (
              <View key={`blocked-finance-${item.id}`} style={styles.actionCard}>
                <DashboardTile
                  title={`${item.student_name || item.student_username || 'Student'} | ${paymentPercent(item).toFixed(0)}% paid`}
                  subtitle={`${item.programme_name || 'Programme pending'} | Paid ${formatCurrency(item.total_paid)} of ${formatCurrency(item.total_due)}`}
                  onPress={() => chooseStudent(item.id, true)}
                  statusColor={selectedStatusId === item.id ? palette.primary : palette.danger}
                />
                <View style={styles.inlineButtons}>
                  <VoiceButton
                    label="Review"
                    size="compact"
                    style={styles.inlineButton}
                    onPress={() => chooseStudent(item.id, true)}
                  />
                </View>
              </View>
            ))
          ) : (
            <DashboardTile
              title="No blocked students"
              subtitle="Students below the threshold will appear here until more payment is recorded."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ready to clear for unit registration</Text>
          {readyToClear.length ? (
            readyToClear.slice(0, 10).map((item) => (
              <View key={`ready-finance-${item.id}`} style={styles.actionCard}>
                <DashboardTile
                  title={`${item.student_name || item.student_username || 'Student'} | Ready to clear`}
                  subtitle={`${paymentPercent(item).toFixed(0)}% paid | Review or clear now`}
                  onPress={() => chooseStudent(item.id, true)}
                  statusColor={selectedStatusId === item.id ? palette.primary : palette.success}
                />
                <View style={styles.inlineButtons}>
                  <VoiceButton
                    label="Review"
                    size="compact"
                    style={styles.inlineButton}
                    onPress={() => chooseStudent(item.id, true)}
                  />
                  <VoiceButton
                    label={actionKey === `clear-${item.id}` ? 'Clearing...' : 'Clear now'}
                    size="compact"
                    style={styles.inlineButton}
                    onPress={() => clearStudentAction(item)}
                  />
                </View>
              </View>
            ))
          ) : (
            <DashboardTile
              title="No students ready yet"
              subtitle="Once payment reaches 60%, the student will appear here for finance clearance."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent payments for selected student</Text>
          {selectedRecentPayments.length ? (
            selectedRecentPayments.map((item) => (
              <DashboardTile
                key={`payment-${item.id}`}
                title={`${formatCurrency(item.amount)} | ${item.method || 'Payment'}`}
                subtitle={`${item.ref || 'No reference'} | Y${item.academic_year} T${item.trimester}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No payments recorded yet"
              subtitle="Recorded payments for the selected student will appear here."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Refresh finance', onPress: () => loadFinance(true) },
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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: palette.surface,
  },
  actionCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  metricsCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: palette.surface,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  input: {
    backgroundColor: palette.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  inlineButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineButton: {
    flexGrow: 1,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  errorCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#FDECEC',
    gap: spacing.xs,
  },
  errorTitle: {
    ...typography.headingM,
    color: palette.danger,
  },
  errorBody: {
    ...typography.helper,
    color: palette.textPrimary,
  },
  successCard: {
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: '#EAF8EF',
    gap: spacing.xs,
  },
  successTitle: {
    ...typography.headingM,
    color: palette.success,
  },
  successBody: {
    ...typography.helper,
    color: palette.textPrimary,
  },
});
