import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GreetingHeader, VoiceButton, AlertBanner } from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import { useAuth } from '@context/AuthContext';
import {
  createGuardianLink,
  fetchCourses,
  fetchGuardianLinks,
  fetchProvisionRequests,
  fetchUsers,
  quickEnrollStudent,
  enrollFamily,
  type ApiCourse,
  type ApiGuardianLink,
  type ApiProvisionRequest,
  type ApiUser,
  type QuickEnrollPayload,
  type FamilyEnrollPayload,
  type FamilyEnrollResponse,
} from '@services/api';

type LinkFormState = {
  guardianUsername: string;
  studentUsername: string;
  relationship: string;
};

type FamilyFormState = {
  student: {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    display_name: string;
    email: string;
    courseCodes: string;
  };
  parent: {
    username: string;
    password: string;
    first_name: string;
    last_name: string;
    display_name: string;
    email: string;
  };
  relationship: string;
  feeTitle: string;
  feeAmount: string;
  feeDueDate: string;
};

const initialLinkState: LinkFormState = {
  guardianUsername: '',
  studentUsername: '',
  relationship: '',
};

const makeInitialFamilyForm = (): FamilyFormState => ({
  student: {
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    display_name: '',
    email: '',
    courseCodes: '',
  },
  parent: {
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    display_name: '',
    email: '',
  },
  relationship: '',
  feeTitle: 'Tuition',
  feeAmount: '',
  feeDueDate: '',
});

const usernameRegex = /^[A-Za-z0-9@.+_-]+$/;
const isValidUsername = (value: string) => usernameRegex.test(value);
const MIN_PASSWORD_LENGTH = 6;

export const RecordsEnrollmentScreen: React.FC = () => {
  const { state } = useAuth();
  const token = state.accessToken;
  const [familyForm, setFamilyForm] = useState<FamilyFormState>(makeInitialFamilyForm);
  const [enrollingFamily, setEnrollingFamily] = useState(false);
  const [linkForm, setLinkForm] = useState<LinkFormState>(initialLinkState);
  const [recordsPasscode, setRecordsPasscode] = useState('');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [links, setLinks] = useState<ApiGuardianLink[]>([]);
  const [requests, setRequests] = useState<ApiProvisionRequest[]>([]);
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [linking, setLinking] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [rosterForm, setRosterForm] = useState({ studentUsername: '', courseCode: '' });
  const [rostering, setRostering] = useState(false);


  const studentUsernameValue = familyForm.student.username.trim();
  const guardianUsernameValue = familyForm.parent.username.trim();
  const studentPasswordValue = familyForm.student.password;
  const guardianPasswordValue = familyForm.parent.password;
  const studentUsernameValid =
    !studentUsernameValue || isValidUsername(studentUsernameValue.toLowerCase());
  const guardianUsernameValid =
    !guardianUsernameValue || isValidUsername(guardianUsernameValue.toLowerCase());
  const canEnrollFamily =
    studentUsernameValue.length > 0 &&
    guardianUsernameValue.length > 0 &&
    studentUsernameValid &&
    guardianUsernameValid &&
    studentPasswordValue.length >= MIN_PASSWORD_LENGTH &&
    guardianPasswordValue.length >= MIN_PASSWORD_LENGTH;

  const guardians = useMemo(() => users.filter((user) => user.role === 'parent'), [users]);
  const students = useMemo(() => users.filter((user) => user.role === 'student'), [users]);
  const filteredStudentOptions = useMemo(() => {
    if (!students.length) {
      return [];
    }
    const query = rosterForm.studentUsername.trim().toLowerCase();
    if (!query) {
      return students.slice(0, 10);
    }
    return students
      .filter((student) => {
        const display = student.display_name || '';
        return (
          student.username.toLowerCase().includes(query) ||
          display.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }, [rosterForm.studentUsername, students]);
  const filteredCourseOptions = useMemo(() => {
    if (!courses.length) {
      return [];
    }
    const query = rosterForm.courseCode.trim().toLowerCase();
    if (!query) {
      return courses.slice(0, 10);
    }
    return courses
      .filter(
        (course) =>
          course.code.toLowerCase().includes(query) ||
          course.name.toLowerCase().includes(query),
      )
      .slice(0, 10);
  }, [courses, rosterForm.courseCode]);

  const loadUsers = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoadingLists(true);
      const data = await fetchUsers(token);
      setUsers(data);
    } catch (error: any) {
      console.warn('Failed to fetch users', error);
      Alert.alert('Unable to load users', error?.message ?? 'Check your connection and try again.');
    } finally {
      setLoadingLists(false);
    }
  }, [token]);

  const loadLinks = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const data = await fetchGuardianLinks(token);
      setLinks(data);
    } catch (error: any) {
      console.warn('Failed to fetch guardian links', error);
      Alert.alert('Unable to load guardian links', error?.message ?? 'Please try again.');
    }
  }, [token]);

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoadingRequests(true);
      const data = await fetchProvisionRequests(token);
      setRequests(data);
    } catch (error: any) {
      console.warn('Failed to fetch provision requests', error);
      Alert.alert('Unable to load requests', error?.message ?? 'Please try again.');
    } finally {
      setLoadingRequests(false);
    }
  }, [token]);

  const loadCourses = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      setLoadingCourses(true);
      const data = await fetchCourses(token);
      setCourses(data);
    } catch (error: any) {
      console.warn('Failed to fetch courses', error);
      Alert.alert('Unable to load courses', error?.message ?? 'Please refresh.');
    } finally {
      setLoadingCourses(false);
    }
  }, [token]);

  const handleFamilyEnroll = useCallback(async () => {
    if (!token) {
      Alert.alert('Not authenticated', 'Please login again.');
      return;
    }
    const passcode = recordsPasscode.trim();
    if (!passcode) {
      Alert.alert('Approval needed', 'Enter the records approval passcode before enrolling.');
      return;
    }
    const studentUsername = studentUsernameValue.toLowerCase();
    const guardianUsername = guardianUsernameValue.toLowerCase();
    if (!studentUsername || !familyForm.student.password.trim()) {
      Alert.alert('Missing student details', 'Provide a username and password for the student.');
      return;
    }
    if (!guardianUsername || !familyForm.parent.password.trim()) {
      Alert.alert('Missing guardian details', 'Provide a username and password for the guardian.');
      return;
    }
    if (studentUsername === guardianUsername) {
      Alert.alert('Invalid usernames', 'Student and guardian usernames must differ.');
      return;
    }
    if (studentPasswordValue.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Student password too short',
        `Student password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (guardianPasswordValue.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Guardian password too short',
        `Guardian password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (!studentUsernameValid) {
      Alert.alert(
        'Invalid student username',
        'Usernames can include letters, numbers, and @ . + - _ only.',
      );
      return;
    }
    if (!guardianUsernameValid) {
      Alert.alert(
        'Invalid guardian username',
        'Usernames can include letters, numbers, and @ . + - _ only.',
      );
      return;
    }

    const courseCodes = familyForm.student.courseCodes
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    const studentPayload: FamilyEnrollPayload['student'] = {
      username: studentUsername,
      password: familyForm.student.password,
    };
    if (familyForm.student.display_name.trim()) {
      studentPayload.display_name = familyForm.student.display_name.trim();
    }
    if (familyForm.student.first_name.trim()) {
      studentPayload.first_name = familyForm.student.first_name.trim();
    }
    if (familyForm.student.last_name.trim()) {
      studentPayload.last_name = familyForm.student.last_name.trim();
    }
    if (familyForm.student.email.trim()) {
      studentPayload.email = familyForm.student.email.trim();
    }
    if (courseCodes.length) {
      studentPayload.course_codes = courseCodes;
    }

    const guardianPayload: FamilyEnrollPayload['parent'] = {
      username: guardianUsername,
      password: familyForm.parent.password,
    };
    if (familyForm.parent.display_name.trim()) {
      guardianPayload.display_name = familyForm.parent.display_name.trim();
    }
    if (familyForm.parent.first_name.trim()) {
      guardianPayload.first_name = familyForm.parent.first_name.trim();
    }
    if (familyForm.parent.last_name.trim()) {
      guardianPayload.last_name = familyForm.parent.last_name.trim();
    }
    if (familyForm.parent.email.trim()) {
      guardianPayload.email = familyForm.parent.email.trim();
    }

    const payload: FamilyEnrollPayload = {
      records_passcode: passcode,
      student: studentPayload,
      parent: guardianPayload,
    };
    if (familyForm.relationship.trim()) {
      payload.relationship = familyForm.relationship.trim();
    }

    if (familyForm.feeAmount.trim()) {
      const amount = parseFloat(familyForm.feeAmount);
      if (Number.isNaN(amount) || amount <= 0) {
        Alert.alert('Invalid fee amount', 'Enter a valid positive number for the initial fee.');
        return;
      }
      payload.fee_item = {
        title: familyForm.feeTitle.trim() || undefined,
        amount,
        due_date: familyForm.feeDueDate.trim() || undefined,
      };
    }

    try {
      setEnrollingFamily(true);
      const response: FamilyEnrollResponse = await enrollFamily(token, payload);
      const responseGuardianUsername = response.parent_request?.username;
      const summary = responseGuardianUsername
        ? `${response.student_request.username} and ${responseGuardianUsername}`
        : response.student_request.username;
      Alert.alert('Requests submitted', `${summary} are awaiting admin approval. You can track them under Pending provisioning requests.`);
      setFamilyForm(makeInitialFamilyForm());
      await loadUsers();
      await loadLinks();
      await loadRequests();
      await loadCourses();
    } catch (error: any) {
      console.warn('Failed to enroll family', error);
      let message = error?.message ?? 'Unable to enroll the family.';
      const detail = error?.details;
      if (detail && typeof detail === 'object') {
        const record = detail as Record<string, unknown>;
        if (typeof record.detail === 'string') {
          message = record.detail;
        } else if (Array.isArray(record.student) && record.student[0]) {
          message = `Student: ${String(record.student[0])}`;
        } else if (Array.isArray(record.parent) && record.parent[0]) {
          message = `Guardian: ${String(record.parent[0])}`;
        } else {
          const studentRecord = record.student;
          if (studentRecord && typeof studentRecord === 'object') {
            const studentFields = studentRecord as Record<string, unknown>;
            if (Array.isArray(studentFields.password) && studentFields.password[0]) {
              message = `Student password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
            } else if (Array.isArray(studentFields.username) && studentFields.username[0]) {
              message = `Student username: ${String(studentFields.username[0])}`;
            }
          }
          const parentRecord = record.parent;
          if (parentRecord && typeof parentRecord === 'object') {
            const parentFields = parentRecord as Record<string, unknown>;
            if (Array.isArray(parentFields.password) && parentFields.password[0]) {
              message = `Guardian password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
            } else if (Array.isArray(parentFields.username) && parentFields.username[0]) {
              message = `Guardian username: ${String(parentFields.username[0])}`;
            }
          }
        }
      }
      Alert.alert('Enrollment failed', message);
    } finally {
      setEnrollingFamily(false);
    }
  }, [
    familyForm,
    loadCourses,
    loadLinks,
    loadRequests,
    loadUsers,
    recordsPasscode,
    token,
    studentUsernameValue,
    guardianUsernameValue,
    studentPasswordValue,
    guardianPasswordValue,
    studentUsernameValid,
    guardianUsernameValid,
  ]);

  const handleCreateLink = useCallback(async () => {
    if (!token) {
      Alert.alert('Not authenticated', 'Please login again.');
      return;
    }
    const passcode = recordsPasscode.trim();
    if (!passcode) {
      Alert.alert('Approval needed', 'Enter the records approval passcode before linking.');
      return;
    }
    const guardian = guardians.find(
      (user) => user.username.toLowerCase() === linkForm.guardianUsername.trim().toLowerCase(),
    );
    const student = students.find(
      (user) => user.username.toLowerCase() === linkForm.studentUsername.trim().toLowerCase(),
    );
    if (!guardian || !student) {
      Alert.alert('Invalid usernames', 'Double-check the guardian and student usernames.');
      return;
    }
    try {
      setLinking(true);
      await createGuardianLink(token, {
        parent: guardian.id,
        student: student.id,
        relationship: linkForm.relationship.trim() || undefined,
        records_passcode: passcode,
      });
      Alert.alert(
        'Linked',
        `${guardian.display_name || guardian.username} is now linked to ${
          student.display_name || student.username
        }.`,
      );
      setLinkForm(initialLinkState);
      await loadLinks();
    } catch (error: any) {
      console.warn('Failed to create guardian link', error);
      let message = error?.message ?? 'Unable to create the guardian/student link.';
      const detail = error?.details;
      if (detail && typeof detail === 'object') {
        const record = detail as Record<string, unknown>;
        if (Array.isArray(record.records_passcode) && record.records_passcode[0]) {
          message = String(record.records_passcode[0]);
        } else if (Array.isArray(record.non_field_errors) && record.non_field_errors[0]) {
          message = String(record.non_field_errors[0]);
        } else if (typeof record.detail === 'string') {
          message = record.detail;
        }
      }
      if (error?.status === 0) {
        message = 'Network unavailable. Check your connection and try again.';
      }
      Alert.alert('Link failed', message);
    } finally {
      setLinking(false);
    }
  }, [guardians, linkForm, loadLinks, recordsPasscode, students, token]);

  const handleRosterEnroll = useCallback(async () => {
    if (!token) {
      Alert.alert('Not authenticated', 'Please login again.');
      return;
    }
    const studentUsername = rosterForm.studentUsername.trim().toLowerCase();
    const courseCode = rosterForm.courseCode.trim().toUpperCase();
    if (!studentUsername || !courseCode) {
      Alert.alert('Missing info', 'Student username and course code are required.');
      return;
    }
    try {
      setRostering(true);
      const payload: QuickEnrollPayload = {
        student_username: studentUsername,
        course_code: courseCode,
      };
      await quickEnrollStudent(token, payload);
      Alert.alert('Enrolled', 'Student has been added to the course.');
      setRosterForm({ studentUsername: '', courseCode: '' });
    } catch (error: any) {
      console.warn('Quick enrollment failed', error);
      Alert.alert('Enrollment failed', error?.message ?? 'Unable to enroll the student.');
    } finally {
      setRostering(false);
    }
  }, [rosterForm, token]);

  const recentLinks = useMemo(() => links.slice(0, 5), [links]);
  const recentRequests = useMemo(() => requests.slice(0, 5), [requests]);
  const refreshUserLists = useCallback(() => {
    loadUsers();
    loadLinks();
  }, [loadLinks, loadUsers]);

  useEffect(() => {
    loadUsers();
    loadLinks();
    loadRequests();
    loadCourses();
  }, [loadUsers, loadLinks, loadRequests, loadCourses]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <GreetingHeader name="Student Onboarding" />
      <AlertBanner
        message="Provision guardian & student accounts, then link them for portal access."
        variant="info"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Records approval passcode</Text>
        <Text style={styles.cardSubtitle}>
          Required before you submit requests or link families.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter passcode"
          value={recordsPasscode}
          onChangeText={setRecordsPasscode}
          autoCapitalize="none"
          secureTextEntry
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Enroll student & guardian together</Text>
        <Text style={styles.cardSubtitle}>
          Capture learner details, link their guardian, assign courses, and seed opening fees in a single step.
        </Text>

        <Text style={styles.formSectionTitle}>Student details</Text>
        <TextInput
          style={styles.input}
          placeholder="Student username"
          value={familyForm.student.username}
          autoCapitalize="none"
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              student: { ...prev.student, username: text },
            }))
          }
        />
        {studentUsernameValue.length > 0 && !studentUsernameValid ? (
          <Text style={styles.errorText}>
            Student username can include letters, numbers, and @ . + - _ only.
          </Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Student password"
          value={familyForm.student.password}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              student: { ...prev.student, password: text },
            }))
          }
          secureTextEntry
        />
        {familyForm.student.password.length > 0 && studentPasswordValue.length < MIN_PASSWORD_LENGTH ? (
          <Text style={styles.errorText}>
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </Text>
        ) : null}
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="First name"
            value={familyForm.student.first_name}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                student: { ...prev.student, first_name: text },
              }))
            }
          />
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Last name"
            value={familyForm.student.last_name}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                student: { ...prev.student, last_name: text },
              }))
            }
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Display name (optional)"
          value={familyForm.student.display_name}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              student: { ...prev.student, display_name: text },
            }))
          }
        />
        <TextInput
          style={styles.input}
          placeholder="Student email (optional)"
          value={familyForm.student.email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              student: { ...prev.student, email: text },
            }))
          }
        />
        <TextInput
          style={styles.input}
          placeholder="Course codes (comma separated, e.g., ENG101, MAT102)"
          autoCapitalize="characters"
          value={familyForm.student.courseCodes}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              student: { ...prev.student, courseCodes: text },
            }))
          }
        />
        <Text style={styles.helperText}>
          Available codes:{' '}
          {courses.length
            ? courses
                .slice(0, 6)
                .map((course) => course.code)
                .join(', ')
            : loadingCourses
            ? 'loading...'
            : 'none loaded yet'}
        </Text>

        <Text style={styles.formSectionTitle}>Guardian details</Text>
        <TextInput
          style={styles.input}
          placeholder="Guardian username"
          value={familyForm.parent.username}
          autoCapitalize="none"
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              parent: { ...prev.parent, username: text },
            }))
          }
        />
        {guardianUsernameValue.length > 0 && !guardianUsernameValid ? (
          <Text style={styles.errorText}>
            Guardian username can include letters, numbers, and @ . + - _ only.
          </Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Guardian password"
          value={familyForm.parent.password}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              parent: { ...prev.parent, password: text },
            }))
          }
          secureTextEntry
        />
        {familyForm.parent.password.length > 0 && guardianPasswordValue.length < MIN_PASSWORD_LENGTH ? (
          <Text style={styles.errorText}>
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </Text>
        ) : null}
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="First name"
            value={familyForm.parent.first_name}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                parent: { ...prev.parent, first_name: text },
              }))
            }
          />
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Last name"
            value={familyForm.parent.last_name}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                parent: { ...prev.parent, last_name: text },
              }))
            }
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Display name (optional)"
          value={familyForm.parent.display_name}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              parent: { ...prev.parent, display_name: text },
            }))
          }
        />
        <TextInput
          style={styles.input}
          placeholder="Guardian email (optional)"
          value={familyForm.parent.email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              parent: { ...prev.parent, email: text },
            }))
          }
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship (e.g., Mother, Guardian)"
          value={familyForm.relationship}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              relationship: text,
            }))
          }
        />

        <Text style={styles.formSectionTitle}>Initial fee setup (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Fee title (e.g., Tuition)"
          value={familyForm.feeTitle}
          onChangeText={(text) =>
            setFamilyForm((prev) => ({
              ...prev,
              feeTitle: text,
            }))
          }
        />
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Amount e.g., 1500"
            value={familyForm.feeAmount}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                feeAmount: text,
              }))
            }
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.flexInput]}
            placeholder="Due date (YYYY-MM-DD)"
            value={familyForm.feeDueDate}
            onChangeText={(text) =>
              setFamilyForm((prev) => ({
                ...prev,
                feeDueDate: text,
              }))
            }
          />
        </View>

        <VoiceButton
          label={enrollingFamily ? 'Enrolling...' : 'Enroll student & guardian'}
          onPress={enrollingFamily || !canEnrollFamily ? undefined : handleFamilyEnroll}
          accessibilityHint="Create linked student and guardian accounts with their starting setup"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Link guardian to student</Text>
        <Text style={styles.cardSubtitle}>
          Use usernames exactly as created above. Approval passcode is required.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Guardian username"
          value={linkForm.guardianUsername}
          autoCapitalize="none"
          onChangeText={(text) => setLinkForm((prev) => ({ ...prev, guardianUsername: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Student username"
          value={linkForm.studentUsername}
          autoCapitalize="none"
          onChangeText={(text) => setLinkForm((prev) => ({ ...prev, studentUsername: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship (optional)"
          value={linkForm.relationship}
          onChangeText={(text) => setLinkForm((prev) => ({ ...prev, relationship: text }))}
        />
        <VoiceButton
          label={linking ? 'Linking...' : 'Link accounts'}
          onPress={linking ? undefined : handleCreateLink}
          accessibilityHint="Create a guardian-student relationship"
        />
        <VoiceButton
          label={loadingLists ? 'Refreshing...' : 'Refresh lists'}
          onPress={refreshUserLists}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent links</Text>
        {recentLinks.length ? (
          recentLinks.map((link) => (
            <View key={link.id} style={styles.linkRow}>
              <Text style={styles.linkPrimary}>
                {link.student_detail.display_name || link.student_detail.username}
              </Text>
              <Text style={styles.linkSecondary}>
                Guardian: {link.parent_detail.display_name || link.parent_detail.username}
                {link.relationship ? ` (${link.relationship})` : ''}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>Linked families will appear here.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Provision request history</Text>
        {loadingRequests ? (
          <ActivityIndicator color={palette.primary} />
        ) : recentRequests.length ? (
          recentRequests.map((request) => (
            <View key={request.id} style={styles.linkRow}>
              <Text style={styles.linkPrimary}>
                {request.username} - {request.role}
              </Text>
              <Text style={styles.linkSecondary}>
                Status: {request.status}
                {request.created_user_detail
                  ? `  ${
                      request.created_user_detail.display_name ||
                      request.created_user_detail.username
                    }`
                  : ''}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>Requests will appear here once submitted.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assign student to course</Text>
        <Text style={styles.cardSubtitle}>Use approved student usernames and course codes.</Text>
        <TextInput
          style={styles.input}
          placeholder="Student username"
          value={rosterForm.studentUsername}
          autoCapitalize="none"
          onChangeText={(text) => setRosterForm((prev) => ({ ...prev, studentUsername: text }))}
        />
        {filteredStudentOptions.length ? (
          <View style={styles.suggestionList}>
            {filteredStudentOptions.map((student, index) => {
              const isLast = index === filteredStudentOptions.length - 1;
              return (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.suggestionItem, isLast && styles.suggestionItemLast]}
                  onPress={() =>
                    setRosterForm((prev) => ({ ...prev, studentUsername: student.username }))
                  }
                >
                  <Text style={styles.suggestionText}>
                    {student.display_name || student.username}
                  </Text>
                  <Text style={styles.suggestionMeta}>{student.username}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Course code (e.g., TTM101)"
          value={rosterForm.courseCode}
          autoCapitalize="characters"
          onChangeText={(text) => setRosterForm((prev) => ({ ...prev, courseCode: text }))}
        />
        {filteredCourseOptions.length ? (
          <View style={styles.suggestionList}>
            {filteredCourseOptions.map((course, index) => {
              const isLast = index === filteredCourseOptions.length - 1;
              return (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.suggestionItem, isLast && styles.suggestionItemLast]}
                  onPress={() => setRosterForm((prev) => ({ ...prev, courseCode: course.code }))}
                >
                  <Text style={styles.suggestionText}>{course.code}</Text>
                  <Text style={styles.suggestionMeta}>{course.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {loadingCourses ? (
          <Text style={styles.helperText}>Loading course list</Text>
        ) : (
          <Text style={styles.helperText}>
            Available courses:{' '}
            {courses
              .slice(0, 3)
              .map((course) => course.code)
              .join(', ') || 'none loaded'}
          </Text>
        )}
        <VoiceButton
          label={rostering ? 'Assigning...' : 'Assign course'}
          onPress={rostering ? undefined : handleRosterEnroll}
          accessibilityHint="Enroll the student into the selected course"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    backgroundColor: palette.background,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  cardSubtitle: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  formSectionTitle: {
    ...typography.helper,
    color: palette.primary,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.disabled,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.background,
  },
  metaText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  helperText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: palette.disabled,
    borderRadius: 16,
    backgroundColor: palette.surface,
    maxHeight: 180,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.disabled,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    ...typography.body,
    color: palette.textPrimary,
  },
  suggestionMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  errorText: {
    ...typography.helper,
    color: palette.danger,
    marginTop: spacing.xs / 2,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  linkRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.disabled,
  },
  linkPrimary: {
    ...typography.body,
    color: palette.textPrimary,
  },
  linkSecondary: {
    ...typography.helper,
    color: palette.textSecondary,
  },
});
