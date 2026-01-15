import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import {
  fetchJson,
  endpoints,
  type ApiUser,
  fetchProvisionRequests,
  type ApiProvisionRequest,
  approveProvisionRequest,
  rejectProvisionRequest,
  emailProvisionCredentials,
} from '@services/api';
import type { Role } from '@app-types/roles';

const roleCycle: Role[] = [
  'student',
  'parent',
  'lecturer',
  'hod',
  'finance',
  'records',
  'admin',
  'superadmin',
  'librarian',
];

const roleLabels: Record<Role, string> = {
  student: 'Students',
  parent: 'Guardians',
  lecturer: 'Lecturers',
  hod: 'Heads of Department',
  finance: 'Finance',
  records: 'Records Office',
  admin: 'Administrators',
  superadmin: 'Super Administrators',
  librarian: 'Librarians',
};

const staffRoles: Role[] = ['lecturer', 'hod', 'finance', 'records', 'admin', 'superadmin', 'librarian'];
const staffRoleSet = new Set<Role>(staffRoles);

const getNextRole = (current: Role): Role => {
  const index = roleCycle.indexOf(current);
  if (index === -1) {
    return 'student';
  }
  return roleCycle[(index + 1) % roleCycle.length];
};

export const AdminUsersScreen: React.FC = () => {
  const { state, assignRole } = useAuth();
  const accessToken = state.accessToken;
  const isSuperAdmin = state.user?.role === 'superadmin';
  const canReviewRequests = ['admin', 'hod', 'superadmin'].includes(state.user?.role ?? '');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [requests, setRequests] = useState<ApiProvisionRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [emailingRequestId, setEmailingRequestId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJson<ApiUser[]>(endpoints.usersList(), accessToken);
      setUsers(data);
    } catch (err: any) {
      console.warn('Failed to load users', err);
      setError(err?.message ?? 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const groupedUsers = useMemo(() => {
    const students = users.filter((user) => user.role === 'student');
    const guardians = users.filter((user) => user.role === 'parent');
    const staff = users.filter((user) => staffRoleSet.has(user.role as Role));
    return { students, guardians, staff };
  }, [users]);

  const staffByRole = useMemo(() => {
    const map = new Map<Role, ApiUser[]>();
    staffRoles.forEach((role) => map.set(role, []));
    groupedUsers.staff.forEach((user) => {
      const role = user.role as Role;
      const existing = map.get(role) ?? [];
      map.set(role, [...existing, user]);
    });
    return map;
  }, [groupedUsers.staff]);

  const loadRequests = useCallback(async () => {
    if (!accessToken || !canReviewRequests) {
      return;
    }
    try {
      setLoadingRequests(true);
      setRequestError(null);
      const data = await fetchProvisionRequests(accessToken);
      setRequests(data);
    } catch (err: any) {
      console.warn('Failed to load provision requests', err);
      setRequestError(err?.message ?? 'Unable to load provisioning requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [accessToken, canReviewRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAssign = useCallback(
    async (user: ApiUser) => {
      if (!isSuperAdmin) {
        Alert.alert('Permissions', 'Only super administrators can change roles.');
        return;
      }
      const nextRole = getNextRole(user.role);
      try {
        setProcessingId(user.id);
        const updated = await assignRole(user.id, nextRole);
        setUsers((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, role: updated.role } : item)),
        );
        Alert.alert(
          'Role updated',
          `${user.username} is now assigned to ${nextRole.toUpperCase()}.`,
        );
      } catch (err: any) {
        Alert.alert('Update failed', err?.message ?? 'Could not assign the new role.');
      } finally {
        setProcessingId(null);
      }
    },
    [assignRole, isSuperAdmin],
  );

  const subtitle = useMemo(() => {
    if (!isSuperAdmin) {
      return 'View accounts grouped by students, guardians, and staff. Role changes require super administrator access.';
    }
    return 'Cycle through roles for each account to keep access aligned with responsibilities. Users are grouped for quicker scanning.';
  }, [isSuperAdmin]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests],
  );
  const approvedRequests = useMemo(
    () =>
      requests.filter((request) => request.status === 'approved' && request.created_user_detail),
    [requests],
  );

  const handleApproveRequest = async (requestId: number) => {
    if (!accessToken || !canReviewRequests) {
      return;
    }
    try {
      setProcessingRequestId(requestId);
      const response = await approveProvisionRequest(accessToken, requestId);
      Alert.alert(
        'Request approved',
        `Temporary password: ${response.temporary_password}\nShare it securely with Records.`,
      );
      loadRequests();
      loadUsers();
    } catch (err: any) {
      console.warn('Approve request failed', err);
      Alert.alert('Approve failed', err?.message ?? 'Unable to approve this request.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleEmailAgain = async (requestId: number) => {
    if (!accessToken || !canReviewRequests) {
      return;
    }
    try {
      setEmailingRequestId(requestId);
      await emailProvisionCredentials(accessToken, requestId);
      Alert.alert('Email sent', 'The credentials were emailed to the requester again.');
    } catch (err: any) {
      console.warn('Email again failed', err);
      Alert.alert('Delivery failed', err?.message ?? 'Unable to send the email right now.');
    } finally {
      setEmailingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    if (!accessToken || !canReviewRequests) {
      return;
    }
    Alert.alert('Reject request', 'Are you sure you want to reject this request?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            setProcessingRequestId(requestId);
            await rejectProvisionRequest(accessToken, requestId, 'Details incomplete');
            Alert.alert('Request rejected', 'The requester has been notified in the Activity log.');
            loadRequests();
          } catch (err: any) {
            console.warn('Reject request failed', err);
            Alert.alert('Reject failed', err?.message ?? 'Unable to reject this request.');
          } finally {
            setProcessingRequestId(null);
          }
        },
      },
    ]);
  };

  const renderUserCard = (user: ApiUser) => (
    <View key={user.id} style={styles.card}>
      <Ionicons name="person" size={28} color={palette.primary} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{user.username}</Text>
        <Text style={styles.cardMeta}>
          Role: {user.role.toUpperCase()} | MFA: {user.totp_enabled ? 'Enabled' : 'Disabled'}
        </Text>
        <Text style={styles.cardMeta}>
          Status: {user.must_change_password ? 'Needs password change' : 'Active'}
        </Text>
        <VoiceButton
          label={
            processingId === user.id
              ? 'Updating...'
              : isSuperAdmin
              ? `Assign next role (${getNextRole(user.role)})`
              : 'View permissions'
          }
          onPress={() =>
            isSuperAdmin ? handleAssign(user) : Alert.alert('Roles', 'Review completed.')
          }
          accessibilityHint="Cycle to the next available role for this user"
        />
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Users & Roles</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <VoiceButton
        label="Refresh list"
        onPress={loadUsers}
        accessibilityHint="Reload the latest user roles"
      />
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.groupSection}>
            <Text style={styles.groupTitle}>
              Students ({groupedUsers.students.length})
            </Text>
            <Text style={styles.groupSubtitle}>
              All enrolled learners with individual dashboards.
            </Text>
            {groupedUsers.students.length ? (
              groupedUsers.students.map(renderUserCard)
            ) : (
              <Text style={styles.helper}>No student accounts found yet.</Text>
            )}
          </View>

          <View style={styles.groupSection}>
            <Text style={styles.groupTitle}>
              Guardians ({groupedUsers.guardians.length})
            </Text>
            <Text style={styles.groupSubtitle}>
              Guardians linked to student records.
            </Text>
            {groupedUsers.guardians.length ? (
              groupedUsers.guardians.map(renderUserCard)
            ) : (
              <Text style={styles.helper}>No guardian accounts found yet.</Text>
            )}
          </View>

          <View style={styles.groupSection}>
            <Text style={styles.groupTitle}>
              Staff ({groupedUsers.staff.length})
            </Text>
            <Text style={styles.groupSubtitle}>
              Lecturers, finance, HODs, records, admin, and support roles.
            </Text>
            {groupedUsers.staff.length ? (
              staffRoles.map((role) => {
                const roleUsers = staffByRole.get(role) ?? [];
                if (!roleUsers.length) {
                  return null;
                }
                return (
                  <View key={role} style={styles.subGroupSection}>
                    <Text style={styles.subGroupTitle}>{roleLabels[role]}</Text>
                    {roleUsers.map(renderUserCard)}
                  </View>
                );
              })
            ) : (
              <Text style={styles.helper}>No staff accounts found yet.</Text>
            )}
          </View>
        </>
      )}
      {canReviewRequests ? (
        <>
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Pending provisioning requests</Text>
            <VoiceButton label="Refresh requests" onPress={loadRequests} />
            {loadingRequests ? (
              <ActivityIndicator color={palette.primary} />
            ) : requestError ? (
              <Text style={styles.error}>{requestError}</Text>
            ) : pendingRequests.length === 0 ? (
              <Text style={styles.helper}>No pending requests right now.</Text>
            ) : (
              pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <Text style={styles.cardTitle}>
                    {request.username} - {request.role.toUpperCase()}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Requested by{' '}
                    {request.requested_by_detail.display_name ||
                      request.requested_by_detail.username}
                  </Text>
                  <View style={styles.requestActions}>
                    <VoiceButton
                      label={processingRequestId === request.id ? 'Approving...' : 'Approve'}
                      onPress={
                        processingRequestId ? undefined : () => handleApproveRequest(request.id)
                      }
                    />
                    <VoiceButton
                      label={processingRequestId === request.id ? 'Processing...' : 'Reject'}
                      onPress={
                        processingRequestId ? undefined : () => handleRejectRequest(request.id)
                      }
                    />
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Approved requests</Text>
            {approvedRequests.length === 0 ? (
              <Text style={styles.helper}>No approved requests to display.</Text>
            ) : (
              approvedRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <Text style={styles.cardTitle}>
                    {request.username} - {request.role.toUpperCase()}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Temporary password:{' '}
                    <Text style={styles.password}>{request.temporary_password ?? 'N/A'}</Text>
                  </Text>
                  <Text style={styles.cardMeta}>
                    Assigned profile:{' '}
                    {request.created_user_detail?.display_name ||
                      request.created_user_detail?.username}
                  </Text>
                  <VoiceButton
                    label={emailingRequestId === request.id ? 'Sending...' : 'Email again'}
                    onPress={emailingRequestId ? undefined : () => handleEmailAgain(request.id)}
                  />
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, backgroundColor: palette.background },
  title: { ...typography.headingXL, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary },
  groupSection: { gap: spacing.sm, marginTop: spacing.lg },
  groupTitle: { ...typography.headingL, color: palette.textPrimary },
  groupSubtitle: { ...typography.helper, color: palette.textSecondary },
  subGroupSection: { gap: spacing.sm, marginTop: spacing.md },
  subGroupTitle: { ...typography.headingM, color: palette.textPrimary },
  error: { ...typography.body, color: palette.danger },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardBody: { flex: 1, gap: spacing.sm },
  cardTitle: { ...typography.headingM, color: palette.textPrimary },
  cardMeta: { ...typography.helper, color: palette.textSecondary },
  requestSection: { gap: spacing.md },
  sectionTitle: { ...typography.headingL, color: palette.textPrimary },
  helper: { ...typography.helper, color: palette.textSecondary },
  requestCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  requestActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  password: {
    ...typography.headingM,
    color: palette.primary,
  },
});
