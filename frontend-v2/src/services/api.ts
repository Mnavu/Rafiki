import type { Role } from '@app-types/roles';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://rafiki-ygwg.onrender.com';
const NETWORK_ERROR_HINT = `Network request failed. Verify EXPO_PUBLIC_API_URL (${API_BASE}) and backend reachability.`;
const ROLE_ALIASES: Record<string, Role> = {
  student: 'student',
  parent: 'parent',
  guardian: 'parent',
  lecturer: 'lecturer',
  teacher: 'lecturer',
  hod: 'hod',
  head_of_department: 'hod',
  finance: 'finance',
  records: 'records',
  admin: 'admin',
  superadmin: 'superadmin',
  librarian: 'librarian',
  guest: 'guest',
};

export type ApiUser = {
  id: number;
  username: string;
  email: string | null;
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  role: Role;
  must_change_password?: boolean;
  prefers_simple_language?: boolean;
  prefers_high_contrast?: boolean;
  speech_rate?: number;
  totp_enabled?: boolean;
};

type TokenResponse = {
  access: string;
  refresh?: string;
};

type LoginPayload = {
  username: string;
  password: string;
  totp_code?: string;
};

type ApiError = Error & { status?: number; details?: unknown };
type QueryValue = string | number | boolean | null | undefined;
type ListPayload<T> = T[] | { results?: T[] };

export type StudentProfile = {
  id: number;
  user: ApiUser;
  programme: number | null;
  year: number;
  trimester: number;
  trimester_label: string;
  cohort_year?: number | null;
  current_status: string;
  stars: number;
};

export type AssignmentSummary = {
  id: number;
  unit: number | null;
  unit_title: string;
  unit_code?: string;
  lecturer: number | null;
  lecturer_name: string;
  title: string;
  description: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationSummary = {
  id: number;
  student: number | null;
  student_name: string;
  student_username?: string;
  unit: number | null;
  unit_code?: string;
  unit_title: string;
  programme_id?: number | null;
  programme_name?: string;
  department_id?: number | null;
  status: string;
  academic_year: number;
  trimester: number;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimetableEntry = {
  id: number;
  programme: number | null;
  unit: number | null;
  unit_title?: string;
  unit_code?: string;
  lecturer: number | null;
  room: string;
  start_datetime: string;
  end_datetime: string;
  created_at: string;
  updated_at: string;
};

export type FinanceStatusSummary = {
  id: number;
  student: number | null;
  student_name?: string;
  student_username?: string;
  student_status?: string;
  programme_name?: string;
  study_year?: number;
  trimester_label?: string;
  academic_year: number;
  trimester: number;
  total_due: string;
  total_paid: string;
  status: string;
  clearance_status: string;
  created_at: string;
  updated_at: string;
};

export type ParentStudentLink = {
  id: number;
  parent: number;
  student: number;
  relationship: string;
  created_at: string;
  updated_at: string;
  parent_detail: ApiUser;
  student_detail: ApiUser;
};

export type ProgressUnit = {
  unit_id: number;
  unit_code: string;
  unit_title: string;
  average_grade: number | null;
  completed: boolean;
};

export type ProgrammeProgress = {
  programme_id: number;
  programme_name: string;
  programme_code: string;
  unit_progress: ProgressUnit[];
  average_score: number | null;
};

export type StudentProgressSummary = {
  student: {
    id: number;
    username: string;
    display_name: string | null;
  };
  programmes: ProgrammeProgress[];
  completed_units: number;
  total_units: number;
};

export type MeritHistoryItem = {
  id: number;
  student: number;
  stars: number;
  reason: string;
  created_at: string;
};

export type StudentRewardsSummary = {
  stars: number;
  history: MeritHistoryItem[];
};

export type CommunicationMessage = {
  id: number;
  thread: number;
  author: number;
  author_detail?: ApiUser;
  body: string;
  audio: string | null;
  transcript: string;
  sender_role: string;
  created_at: string;
  updated_at: string;
};

export type CommunicationThread = {
  id: number;
  subject: string;
  student: number;
  teacher: number;
  parent: number | null;
  student_detail?: ApiUser;
  teacher_detail?: ApiUser;
  parent_detail?: ApiUser | null;
  messages: CommunicationMessage[];
  created_at: string;
  updated_at: string;
};

export type StudentPeerSummary = {
  user_id: number;
  username: string;
  display_name: string;
  year: number;
  shared_units: string[];
};

export type ChatbotAskResponse = {
  text: string;
  visual_cue: string | null;
  conversation_id?: number | null;
  turn_id?: number | null;
  navigation_target?: string | null;
};

export type ChatbotFeedbackResponse = {
  id: number;
  rating: 'helpful' | 'not_helpful';
  needs_review: boolean;
};

const withQuery = (path: string, query?: Record<string, QueryValue>) => {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });
  const encoded = params.toString();
  if (!encoded) {
    return path;
  }
  return `${path}${path.includes('?') ? '&' : '?'}${encoded}`;
};

const withAuthHeaders = (accessToken: string, contentType = false): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { 'Content-Type': 'application/json' } : {}),
});

const normalizeList = <T>(payload: ListPayload<T>): T[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.results ?? [];
};

const normalizeRole = (value: unknown): Role => {
  if (typeof value !== 'string') {
    return 'guest';
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_ALIASES[normalized] ?? 'guest';
};

const isPlaceholderDisplayName = (value: string | null | undefined): boolean => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.startsWith('demo student') || normalized.startsWith('demo guardian');
};

const isPlaceholderUsername = (value: string | null | undefined): boolean => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.startsWith('demo_student') || normalized.startsWith('demo_guardian');
};

const resolveDisplayName = (
  user: Partial<Pick<ApiUser, 'username' | 'display_name' | 'first_name' | 'last_name'>> | null | undefined,
): string | null => {
  if (!user) {
    return null;
  }
  const display = user.display_name?.trim();
  const names = `${user.first_name?.trim() ?? ''} ${user.last_name?.trim() ?? ''}`.trim();
  const username = user.username?.trim() ?? '';
  if (display && !isPlaceholderDisplayName(display)) {
    return display;
  }
  if (names) {
    return names;
  }
  if (username && !isPlaceholderUsername(username)) {
    return username;
  }
  return display || username || null;
};

const normalizeUser = (user: ApiUser): ApiUser => ({
  ...user,
  display_name: resolveDisplayName(user),
  role: normalizeRole(user.role),
});

const normalizeThread = (thread: CommunicationThread): CommunicationThread => ({
  ...thread,
  student_detail: thread.student_detail ? normalizeUser(thread.student_detail) : thread.student_detail,
  teacher_detail: thread.teacher_detail ? normalizeUser(thread.teacher_detail) : thread.teacher_detail,
  parent_detail: thread.parent_detail ? normalizeUser(thread.parent_detail) : thread.parent_detail,
  messages: thread.messages.map((message) => ({
    ...message,
    author_detail: message.author_detail ? normalizeUser(message.author_detail) : message.author_detail,
  })),
});

const extractErrorMessage = (data: unknown): string | null => {
  if (!data) {
    return null;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    const first = data.find((item) => item !== undefined && item !== null);
    return first ? extractErrorMessage(first) : null;
  }
  if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    const firstKey = Object.keys(record)[0];
    if (firstKey) {
      return extractErrorMessage(record[firstKey]);
    }
  }
  return null;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let details: unknown = null;
  try {
    details = await response.json();
  } catch {
    details = null;
  }
  const error = new Error(extractErrorMessage(details) ?? response.statusText) as ApiError;
  error.status = response.status;
  error.details = details;
  throw error;
};

const getJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, init);
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

const postJson = async <T>(path: string, accessToken: string, body: unknown): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: withAuthHeaders(accessToken, true),
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

const putJson = async <T>(path: string, accessToken: string, body: unknown): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: withAuthHeaders(accessToken, true),
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

const patchJson = async <T>(path: string, accessToken: string, body: unknown): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: withAuthHeaders(accessToken, true),
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

const deleteJson = async (path: string, accessToken: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: withAuthHeaders(accessToken),
    });
    if (!response.ok) {
      await handleResponse(response);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const loginRequest = async (payload: LoginPayload): Promise<TokenResponse> => {
  try {
    const response = await fetch(`${API_BASE}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<TokenResponse>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const fetchProfile = async (accessToken: string): Promise<ApiUser> => {
  const response = await fetch(`${API_BASE}/api/users/me/`, {
    headers: withAuthHeaders(accessToken),
  });
  const user = await handleResponse<ApiUser>(response);
  return normalizeUser(user);
};

export const updateMyProfile = async (
  accessToken: string,
  payload: { username?: string; display_name?: string },
): Promise<ApiUser> => {
  const user = await patchJson<ApiUser>('/api/users/me/', accessToken, payload);
  return normalizeUser(user);
};

export const fetchStudentProfile = (accessToken: string, userId: number): Promise<StudentProfile> =>
  getJson<StudentProfile>(`/api/users/students/${userId}/`, {
    headers: withAuthHeaders(accessToken),
  });

export const fetchStudentAssignments = async (accessToken: string): Promise<AssignmentSummary[]> => {
  const payload = await getJson<ListPayload<AssignmentSummary>>('/api/learning/assignments/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchLecturerAssignments = async (
  accessToken: string,
  unitId?: number | null,
): Promise<AssignmentSummary[]> => {
  const payload = await getJson<ListPayload<AssignmentSummary>>(
    withQuery('/api/learning/assignments/', { unit: unitId ?? undefined }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export type LecturerAssignmentPayload = {
  unit: number;
  title: string;
  description: string;
  due_at: string;
};

export const createLecturerAssignment = (
  accessToken: string,
  payload: LecturerAssignmentPayload,
): Promise<AssignmentSummary> =>
  postJson<AssignmentSummary>('/api/learning/assignments/', accessToken, payload);

export const updateLecturerAssignment = (
  accessToken: string,
  assignmentId: number,
  payload: Partial<LecturerAssignmentPayload>,
): Promise<AssignmentSummary> =>
  patchJson<AssignmentSummary>(`/api/learning/assignments/${assignmentId}/`, accessToken, payload);

export const deleteLecturerAssignment = (
  accessToken: string,
  assignmentId: number,
): Promise<void> => deleteJson(`/api/learning/assignments/${assignmentId}/`, accessToken);

export const fetchStudentSubmissions = async (
  accessToken: string,
  assignmentId?: number | null,
): Promise<SubmissionSummary[]> => {
  const payload = await getJson<ListPayload<SubmissionSummary>>(
    withQuery('/api/learning/submissions/', { assignment: assignmentId ?? undefined }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export type StudentSubmissionPayload = {
  assignmentId: number;
  contentUrl?: string;
  textResponse?: string;
  audioTranscript?: string;
  audioUri?: string;
  audioMimeType?: string;
};

export const submitStudentSubmission = async (
  accessToken: string,
  payload: StudentSubmissionPayload,
): Promise<SubmissionSummary> => {
  const form = new FormData();
  form.append('assignment', String(payload.assignmentId));
  if (payload.contentUrl && payload.contentUrl.trim()) {
    form.append('content_url', payload.contentUrl.trim());
  }
  if (payload.textResponse && payload.textResponse.trim()) {
    form.append('text_response', payload.textResponse.trim());
  }
  if (payload.audioTranscript && payload.audioTranscript.trim()) {
    form.append('audio_transcript', payload.audioTranscript.trim());
  }
  if (payload.audioUri) {
    form.append(
      'audio',
      {
        uri: payload.audioUri,
        name: `assignment-audio-${Date.now()}.m4a`,
        type: payload.audioMimeType ?? 'audio/m4a',
      } as any,
    );
  }

  try {
    const response = await fetch(`${API_BASE}/api/learning/submissions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });
    return handleResponse<SubmissionSummary>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const fetchStudentRegistrations = async (accessToken: string): Promise<RegistrationSummary[]> => {
  const payload = await getJson<ListPayload<RegistrationSummary>>('/api/learning/registrations/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchStudentTimetable = async (
  accessToken: string,
  programmeId?: number | null,
): Promise<TimetableEntry[]> => {
  const path = withQuery('/api/learning/timetables/', { programme: programmeId ?? undefined });
  const payload = await getJson<ListPayload<TimetableEntry>>(path, {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchStudentFinanceStatuses = async (
  accessToken: string,
): Promise<FinanceStatusSummary[]> => {
  const payload = await getJson<ListPayload<FinanceStatusSummary>>('/api/finance/status/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchStudentRewards = (accessToken: string, studentId: number): Promise<StudentRewardsSummary> =>
  getJson<StudentRewardsSummary>(`/api/rewards/student/${studentId}/`, {
    headers: withAuthHeaders(accessToken),
  });

export const fetchParentStudentLinks = async (accessToken: string): Promise<ParentStudentLink[]> => {
  const payload = await getJson<ListPayload<ParentStudentLink>>('/api/users/parent-links/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const createParentStudentLink = (
  accessToken: string,
  payload: { parent: number; student: number; relationship: string; records_passcode?: string },
): Promise<ParentStudentLink> =>
  postJson<ParentStudentLink>('/api/users/parent-links/', accessToken, payload);

export const fetchStudentProgressSummary = (
  accessToken: string,
  studentId: number,
): Promise<StudentProgressSummary> =>
  getJson<StudentProgressSummary>(`/api/learning/students/${studentId}/progress/`, {
    headers: withAuthHeaders(accessToken),
  });

export const fetchCommunicationThreads = async (
  accessToken: string,
): Promise<CommunicationThread[]> => {
  const payload = await getJson<ListPayload<CommunicationThread>>('/api/communications/threads/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload).map(normalizeThread);
};

export const askChatbot = (
  accessToken: string,
  query: string,
  conversationId?: number | null,
  newConversation = false,
): Promise<ChatbotAskResponse> =>
  postJson<ChatbotAskResponse>('/api/chatbot/ask/', accessToken, {
    query,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    ...(newConversation ? { new_conversation: true } : {}),
  });

export const submitChatbotFeedback = (
  accessToken: string,
  payload: {
    turnId: number;
    rating: 'helpful' | 'not_helpful';
    queryText?: string;
    answerText?: string;
    visualCue?: string | null;
    navigationTarget?: string | null;
  },
): Promise<ChatbotFeedbackResponse> =>
  postJson<ChatbotFeedbackResponse>('/api/chatbot/feedback/', accessToken, {
    turn_id: payload.turnId,
    rating: payload.rating,
    ...(payload.queryText ? { query_text: payload.queryText } : {}),
    ...(payload.answerText ? { answer_text: payload.answerText } : {}),
    ...(payload.visualCue ? { visual_cue: payload.visualCue } : {}),
    ...(payload.navigationTarget ? { navigation_target: payload.navigationTarget } : {}),
  });

export const fetchStudentPeers = async (accessToken: string): Promise<StudentPeerSummary[]> => {
  const payload = await getJson<ListPayload<StudentPeerSummary>>('/api/learning/students/me/peers/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload).map((peer) => ({
    ...peer,
    display_name: resolveDisplayName(peer) ?? peer.username,
  }));
};

export const fetchStudentLecturers = async (accessToken: string): Promise<ApiUser[]> => {
  const payload = await getJson<ListPayload<ApiUser>>('/api/learning/my-lecturers/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload).map(normalizeUser);
};

export const createStudentLecturerThread = (
  accessToken: string,
  lecturerId: number,
): Promise<CommunicationThread> =>
  postJson<CommunicationThread>('/api/communications/threads/student-direct-message/', accessToken, {
    lecturer_id: lecturerId,
  }).then(normalizeThread);

export const createStudentPeerThread = (
  accessToken: string,
  peerStudentId: number,
): Promise<CommunicationThread> =>
  postJson<CommunicationThread>('/api/communications/threads/student-peer-message/', accessToken, {
    peer_student_id: peerStudentId,
  }).then(normalizeThread);

export type CreateCommunicationMessagePayload = {
  threadId: number;
  body?: string;
  transcript?: string;
  audioUri?: string;
  audioMimeType?: string;
};

export type AudioTranscriptionResponse = {
  text: string;
  raw_text?: string;
  confidence?: number;
};

export const createCommunicationMessage = async (
  accessToken: string,
  payload: CreateCommunicationMessagePayload,
): Promise<CommunicationMessage> => {
  const form = new FormData();
  form.append('thread', String(payload.threadId));
  if (payload.body && payload.body.trim()) {
    form.append('body', payload.body.trim());
  }
  if (payload.transcript && payload.transcript.trim()) {
    form.append('transcript', payload.transcript.trim());
  }
  if (payload.audioUri) {
    form.append(
      'audio',
      {
        uri: payload.audioUri,
        name: `voice-${Date.now()}.m4a`,
        type: payload.audioMimeType ?? 'audio/m4a',
      } as any,
    );
  }

  try {
    const response = await fetch(`${API_BASE}/api/communications/messages/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });
    return handleResponse<CommunicationMessage>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const transcribeAudio = async (
  accessToken: string,
  payload: { audioUri: string; audioMimeType?: string },
): Promise<AudioTranscriptionResponse> => {
  const form = new FormData();
  form.append(
    'audio',
    {
      uri: payload.audioUri,
      name: `search-${Date.now()}.m4a`,
      type: payload.audioMimeType ?? 'audio/m4a',
    } as any,
  );

  try {
    const response = await fetch(`${API_BASE}/api/core/transcribe/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });
    return handleResponse<AudioTranscriptionResponse>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export type SubmissionSummary = {
  id: number;
  assignment: number | null;
  assignment_title?: string;
  assignment_due_at?: string | null;
  unit_title?: string;
  unit_code?: string;
  student: number | null;
  submitted_at: string;
  content_url: string;
  text_response?: string;
  audio?: string | null;
  audio_url?: string;
  audio_transcript?: string;
  grade: string | number | null;
  feedback_text: string | null;
  feedback_media_url: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProvisionRequestSummary = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: Role;
  status: 'pending' | 'approved' | 'rejected' | string;
  requested_by: number;
  requested_by_detail: ApiUser;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string;
  created_user: number | null;
  created_user_detail: ApiUser | null;
  temporary_password: string;
  created_at: string;
  updated_at: string;
};

export type FamilyEnrollmentAccountPayload = {
  username: string;
  password: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export type FamilyEnrollmentPayload = {
  records_passcode: string;
  student: FamilyEnrollmentAccountPayload;
  parent: FamilyEnrollmentAccountPayload;
  relationship?: string;
  fee_item?: {
    title?: string;
    amount: string;
    due_date?: string | null;
  };
  programme: number;
  year: number;
  trimester: number;
  trimester_label: string;
  cohort_year: number;
};

export type FamilyEnrollmentResponse = {
  detail: string;
  student_request: UserProvisionRequestSummary;
  parent_request: UserProvisionRequestSummary;
  course_codes: string[];
};

export type ProgrammeCurriculumUnit = {
  id: number;
  programme: number | null;
  code: string;
  title: string;
  credit_hours: number;
  trimester_hint: number | null;
  has_prereq: boolean;
  prereq_unit: number | null;
  created_at: string;
  updated_at: string;
};

export type TermOfferingSummary = {
  id: number;
  programme: number | null;
  unit: number | null;
  academic_year: number;
  trimester: number;
  offered: boolean;
  capacity: number | null;
  created_at: string;
  updated_at: string;
};

export type PaymentSummary = {
  id: number;
  student: number | null;
  student_name?: string;
  student_username?: string;
  academic_year: number;
  trimester: number;
  amount: string;
  method: string;
  ref: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationSummary = {
  id: number;
  user: number | null;
  type: string;
  channel: string;
  payload: Record<string, unknown> | null;
  send_at: string;
  status: 'queued' | 'sent' | 'read' | string;
  created_at: string;
  updated_at: string;
};

export type ResourceTagSummary = {
  id: number;
  name: string;
  description: string;
  icon: string;
  created_at: string;
  updated_at: string;
};

export type LibraryAssetSummary = {
  id: number;
  programme: number | null;
  unit: number | null;
  title: string;
  type: 'pdf' | 'video' | 'audio' | 'link' | string;
  url: string;
  visibility: 'programme' | 'unit' | string;
  tags: ResourceTagSummary[];
  created_at: string;
  updated_at: string;
};

export type QuizChoiceSummary = {
  id: number;
  text: string;
};

export type QuizQuestionSummary = {
  id: number;
  text: string;
  choices: QuizChoiceSummary[];
};

export type QuizSummary = {
  id: number;
  title: string;
  description: string;
  unit: number;
  questions: QuizQuestionSummary[];
};

export type DepartmentSummary = {
  id: number;
  name: string;
  code: string;
};

export type DepartmentLecturerSummary = {
  id: number;
  name: string;
  unit_count: number;
};

export type DepartmentProgrammeSummary = {
  id: number;
  name: string;
};

export type DepartmentStudentSummary = {
  id: number;
  username: string;
  display_name: string;
  unit_ids: number[];
  unit_codes: string[];
};

export type DepartmentStructure = {
  department: DepartmentSummary;
  hod: {
    user_id: number;
    name: string;
  } | null;
  lecturers: Array<{
    user_id: number;
    name: string;
  }>;
};

export type DepartmentStaffCandidate = {
  user_id: number;
  name: string;
  department_id: number | null;
  department_name: string | null;
  is_current: boolean;
};

export type DepartmentStaffPool = {
  hods: DepartmentStaffCandidate[];
  lecturers: DepartmentStaffCandidate[];
};

export type DepartmentAssignmentResponse = {
  detail: string;
  department_id: number;
  hod_user_id?: number;
  hod_name?: string;
  lecturer_user_id?: number;
  lecturer_name?: string;
};

export type OfferingLecturerAssignmentResponse = {
  detail: string;
  department_id: number;
  assignment_id: number;
  unit_id: number;
  unit_code: string;
  academic_year: number;
  trimester: number;
  lecturer_user_id: number;
  lecturer_name: string;
  replaced_assignment_ids: number[];
};

export type OfferingLecturerClearResponse = {
  detail: string;
  department_id: number;
  unit_id: number;
  unit_code: string;
  academic_year: number;
  trimester: number;
  removed_assignment_ids: number[];
};

export type AdminAnalyticsSummary = {
  weekly_logins: number;
  chatbot_questions: number;
  alerts_sent: number;
};

export type PipelineStudentSummary = {
  user: ApiUser;
  programme: number | null;
  year: number;
  trimester: number;
  trimester_label: string;
  cohort_year?: number | null;
  current_status: string;
  stars: number;
};

export type StudentPipelinePreview = {
  student_id: number;
  current_status: string;
  next_expected_step: string;
  progress: string[];
  message: string;
};

export type GovernanceTabulation = {
  key: string;
  label: string;
  value: number;
};

export type GovernanceSnapshot = {
  generated_at: string;
  user_access: {
    total_users: number;
    active_last_7_days: number;
    role_breakdown: Array<{ role: string; total: number }>;
  };
  academic_delivery: {
    pending_registrations: number;
    approved_registrations: number;
    current_assignments: number;
  };
  assessment_pipeline: {
    total_submissions: number;
    ungraded_submissions: number;
    pending_to_grade_ratio_percent: number;
  };
  communication_sla: {
    unresolved_threads_24h: number;
    unresolved_threads_48h: number;
  };
  finance_registration: {
    blocked_finance_students: number;
    pending_hod_approvals: number;
  };
  governance: {
    pending_approval_requests: number;
    open_risk_flags: number;
    critical_risk_flags: number;
  };
};

export type GovernanceTabulationsResponse = {
  snapshot: GovernanceSnapshot;
  tabulations: GovernanceTabulation[];
};

export type GovernanceReportRecord = {
  id: number;
  name: string;
  report_type: string;
  format: 'json' | 'csv' | string;
  status: string;
  generated_by: number | null;
  generated_by_detail?: ApiUser | null;
  schedule: number | null;
  scope: Record<string, unknown>;
  summary: Record<string, unknown>;
  payload: Array<Record<string, unknown>>;
  rows_count: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type GovernanceReportGeneratePayload = {
  name?: string;
  report_type: string;
  format?: 'json' | 'csv';
  scope?: Record<string, unknown>;
  schedule_id?: number;
  download_csv?: boolean;
};

export type GovernanceSchedule = {
  id: number;
  name: string;
  report_type: string;
  frequency: 'daily' | 'weekly' | 'monthly' | string;
  next_run_at: string;
  is_active: boolean;
  recipients: string[];
  scope: Record<string, unknown>;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernanceAuditLog = {
  id: number;
  event_id: string;
  created_at: string;
  actor_user: number | null;
  actor_user_detail?: ApiUser | null;
  action: string;
  target_table: string;
  target_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  request_id: string;
  request_path: string;
  request_method: string;
  request_status: number | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown> | null;
  previous_hash: string;
  integrity_hash: string;
};

export type GovernanceRiskFlag = {
  id: number;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: 'open' | 'acknowledged' | 'resolved' | string;
  reason: string;
  metadata: Record<string, unknown>;
  user: number | null;
  user_detail?: ApiUser | null;
  student: number | null;
  student_detail?: {
    id: number;
    username: string;
    display_name: string;
    year: number;
    trimester: number;
  } | null;
  programme: number | null;
  unit: number | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernanceApprovalRequest = {
  id: number;
  action_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | string;
  requested_by: number;
  requested_by_detail?: ApiUser | null;
  target_user: number | null;
  target_user_detail?: ApiUser | null;
  reviewed_by: number | null;
  reviewed_by_detail?: ApiUser | null;
  reviewed_at: string | null;
  payload: Record<string, unknown>;
  comment: string;
  approved_payload: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernancePolicy = {
  id: number;
  name: string;
  audit_retention_days: number;
  chat_retention_days: number;
  report_retention_days: number;
  backup_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly' | string;
  backup_location: string;
  immutable_audit_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type GovernanceAlertPolicy = {
  id: number;
  role: string;
  metric_key: string;
  warning_threshold: number;
  critical_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GovernanceActivityItem = {
  id: string;
  kind: 'audit' | 'report' | 'approval' | 'risk' | string;
  timestamp: string;
  title: string;
  description: string;
  actor: {
    id: number;
    username: string;
    display_name: string;
    role: string;
  } | null;
  metadata: Record<string, unknown>;
};

export type ProgrammeSummary = {
  id: number;
  department: number | null;
  name: string;
  code: string;
  award_level: string;
  duration_years: number;
  trimesters_per_year: number;
  created_at: string;
  updated_at: string;
};

export const fetchLecturerGradingQueue = async (
  accessToken: string,
): Promise<SubmissionSummary[]> => {
  const payload = await getJson<ListPayload<SubmissionSummary>>('/api/learning/lecturer-grading/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchHodPendingApprovals = async (
  accessToken: string,
): Promise<RegistrationSummary[]> => {
  const payload = await getJson<ListPayload<RegistrationSummary>>('/api/learning/hod-unit-approval/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const approveHodRegistrations = (
  accessToken: string,
  registrationIds: number[],
): Promise<RegistrationSummary[]> =>
  postJson<RegistrationSummary[]>(
    '/api/learning/hod-unit-approval/approve_registrations/',
    accessToken,
    { registration_ids: registrationIds },
  );

export const rejectHodRegistrations = (
  accessToken: string,
  registrationIds: number[],
  reason?: string,
): Promise<{ status: string; reason: string }> =>
  postJson<{ status: string; reason: string }>(
    '/api/learning/hod-unit-approval/reject_registrations/',
    accessToken,
    { registration_ids: registrationIds, reason },
  );

export const fetchUsers = async (
  accessToken: string,
  params?: { role?: Role },
): Promise<ApiUser[]> => {
  const payload = await getJson<ListPayload<ApiUser>>(
    withQuery('/api/users/users/', { role: params?.role }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export type AdminUserCreatePayload = {
  username: string;
  password: string;
  role: Role;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  prefers_simple_language?: boolean;
  prefers_high_contrast?: boolean;
  speech_rate?: number;
};

export const createAdminUser = (
  accessToken: string,
  payload: AdminUserCreatePayload,
): Promise<ApiUser> =>
  postJson<ApiUser>('/api/users/admin-create/', accessToken, payload);

export const adminResetUserPassword = (
  accessToken: string,
  payload: { user_id?: number; username?: string; new_password?: string },
): Promise<{ detail: string; temporary_password: string; user: ApiUser }> =>
  postJson<{ detail: string; temporary_password: string; user: ApiUser }>(
    '/api/users/admin-reset-password/',
    accessToken,
    payload,
  ).then((response) => ({
    ...response,
    user: normalizeUser(response.user),
  }));

export const assignUserRole = (
  accessToken: string,
  payload: { user_id: number; role: Role },
): Promise<ApiUser> =>
  postJson<ApiUser>('/api/users/assign-role/', accessToken, payload);

export const fetchProvisionRequests = async (
  accessToken: string,
): Promise<UserProvisionRequestSummary[]> => {
  const payload = await getJson<ListPayload<UserProvisionRequestSummary>>(
    '/api/users/provision-requests/',
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const enrollFamily = (
  accessToken: string,
  payload: FamilyEnrollmentPayload,
): Promise<FamilyEnrollmentResponse> =>
  postJson<FamilyEnrollmentResponse>('/api/users/enroll-family/', accessToken, payload);

export const approveProvisionRequest = (
  accessToken: string,
  requestId: number,
): Promise<{ user: ApiUser; temporary_password: string }> =>
  postJson<{ user: ApiUser; temporary_password: string }>(
    `/api/users/provision-requests/${requestId}/approve/`,
    accessToken,
    {},
  );

export const rejectProvisionRequest = (
  accessToken: string,
  requestId: number,
  reason?: string,
): Promise<UserProvisionRequestSummary> =>
  postJson<UserProvisionRequestSummary>(
    `/api/users/provision-requests/${requestId}/reject/`,
    accessToken,
    { reason: reason ?? '' },
  );

export const fetchFinancePayments = async (accessToken: string): Promise<PaymentSummary[]> => {
  const payload = await getJson<ListPayload<PaymentSummary>>('/api/finance/payments/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const recordFinancePayment = (
  accessToken: string,
  financeStatusId: number,
  payload: { amount: string; method?: string; ref?: string },
): Promise<{
  detail: string;
  payment: PaymentSummary;
  finance_status: FinanceStatusSummary;
  percentage_paid: number;
}> =>
  postJson<{
    detail: string;
    payment: PaymentSummary;
    finance_status: FinanceStatusSummary;
    percentage_paid: number;
  }>(`/api/finance/status/${financeStatusId}/record_payment/`, accessToken, payload);

export const openFinanceRegistration = (
  accessToken: string,
  financeStatusId: number,
): Promise<{
  detail: string;
  percentage_paid: number;
  student_id: number;
  finance_status_id: number;
}> =>
  postJson<{
    detail: string;
    percentage_paid: number;
    student_id: number;
    finance_status_id: number;
  }>(`/api/finance/status/${financeStatusId}/open_registration/`, accessToken, {});

export const fetchNotifications = async (
  accessToken: string,
  userId?: number,
): Promise<NotificationSummary[]> => {
  const payload = await getJson<ListPayload<NotificationSummary>>(
    withQuery('/api/notifications/', { user_id: userId }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchLibraryAssets = async (accessToken: string): Promise<LibraryAssetSummary[]> => {
  const payload = await getJson<ListPayload<LibraryAssetSummary>>('/api/repository/assets/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchQuizzes = async (accessToken: string): Promise<QuizSummary[]> => {
  const payload = await getJson<ListPayload<QuizSummary>>('/api/learning/quizzes/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchProgrammes = async (accessToken: string): Promise<ProgrammeSummary[]> => {
  const payload = await getJson<ListPayload<ProgrammeSummary>>('/api/learning/programmes/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchProgrammeCurriculum = async (
  accessToken: string,
  programmeId: number,
): Promise<ProgrammeCurriculumUnit[]> => {
  const payload = await getJson<ListPayload<ProgrammeCurriculumUnit>>(
    `/api/learning/programmes/${programmeId}/curriculum/`,
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchTermOfferings = async (
  accessToken: string,
  params?: { programme?: number; academic_year?: number; trimester?: number; offered?: boolean },
): Promise<TermOfferingSummary[]> => {
  const payload = await getJson<ListPayload<TermOfferingSummary>>(
    withQuery('/api/learning/term-offerings/', {
      programme: params?.programme,
      academic_year: params?.academic_year,
      trimester: params?.trimester,
      offered: params?.offered,
    }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const submitStudentUnitSelection = (
  accessToken: string,
  payload: { unit_ids: number[] },
): Promise<RegistrationSummary[]> =>
  postJson<RegistrationSummary[]>('/api/learning/student-unit-selection/', accessToken, payload);

export const fetchDepartments = async (accessToken: string): Promise<DepartmentSummary[]> => {
  const payload = await getJson<ListPayload<DepartmentSummary>>('/api/core/api/departments/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchDepartmentLecturers = async (
  accessToken: string,
  departmentId: number,
): Promise<DepartmentLecturerSummary[]> => {
  const payload = await getJson<ListPayload<DepartmentLecturerSummary>>(
    `/api/core/api/departments/${departmentId}/lecturers/`,
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchDepartmentProgrammes = async (
  accessToken: string,
  departmentId: number,
): Promise<DepartmentProgrammeSummary[]> => {
  const payload = await getJson<ListPayload<DepartmentProgrammeSummary>>(
    `/api/core/api/departments/${departmentId}/programmes/`,
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchDepartmentStudents = async (
  accessToken: string,
  departmentId: number,
): Promise<DepartmentStudentSummary[]> => {
  const payload = await getJson<ListPayload<DepartmentStudentSummary>>(
    `/api/core/api/departments/${departmentId}/students/`,
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchDepartmentStructure = (
  accessToken: string,
  departmentId: number,
): Promise<DepartmentStructure> =>
  getJson<DepartmentStructure>(`/api/core/api/departments/${departmentId}/structure/`, {
    headers: withAuthHeaders(accessToken),
  });

export const fetchDepartmentStaffPool = (
  accessToken: string,
  departmentId: number,
): Promise<DepartmentStaffPool> =>
  getJson<DepartmentStaffPool>(`/api/core/api/departments/${departmentId}/available_staff/`, {
    headers: withAuthHeaders(accessToken),
  });

export const assignDepartmentHod = (
  accessToken: string,
  departmentId: number,
  hodUserId: number,
): Promise<DepartmentAssignmentResponse> =>
  postJson<DepartmentAssignmentResponse>(
    `/api/core/api/departments/${departmentId}/assign_hod/`,
    accessToken,
    { hod_user_id: hodUserId },
  );

export const assignDepartmentLecturer = (
  accessToken: string,
  departmentId: number,
  lecturerUserId: number,
): Promise<DepartmentAssignmentResponse> =>
  postJson<DepartmentAssignmentResponse>(
    `/api/core/api/departments/${departmentId}/assign_lecturer/`,
    accessToken,
    { lecturer_user_id: lecturerUserId },
  );

export const removeDepartmentLecturer = (
  accessToken: string,
  departmentId: number,
  lecturerUserId: number,
): Promise<DepartmentAssignmentResponse> =>
  postJson<DepartmentAssignmentResponse>(
    `/api/core/api/departments/${departmentId}/remove_lecturer/`,
    accessToken,
    { lecturer_user_id: lecturerUserId },
  );

export const assignOfferingLecturer = (
  accessToken: string,
  departmentId: number,
  payload: {
    unit_id: number;
    lecturer_user_id: number;
    academic_year: number;
    trimester: number;
  },
): Promise<OfferingLecturerAssignmentResponse> =>
  postJson<OfferingLecturerAssignmentResponse>(
    `/api/core/api/departments/${departmentId}/assign_offering_lecturer/`,
    accessToken,
    payload,
  );

export const clearOfferingLecturer = (
  accessToken: string,
  departmentId: number,
  payload: { unit_id: number; academic_year: number; trimester: number },
): Promise<OfferingLecturerClearResponse> =>
  postJson<OfferingLecturerClearResponse>(
    `/api/core/api/departments/${departmentId}/clear_offering_lecturer/`,
    accessToken,
    payload,
  );

export const fetchAdminAnalytics = (accessToken: string): Promise<AdminAnalyticsSummary> =>
  getJson<AdminAnalyticsSummary>('/api/core/api/admin/analytics/', {
    headers: withAuthHeaders(accessToken),
  });

export const fetchAdminPipelineStudents = async (
  accessToken: string,
): Promise<PipelineStudentSummary[]> => {
  const payload = await getJson<ListPayload<PipelineStudentSummary>>('/api/core/api/admin/pipeline/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchAdminPipelinePreview = (
  accessToken: string,
  studentId: number,
): Promise<StudentPipelinePreview> =>
  getJson<StudentPipelinePreview>(`/api/core/api/admin/pipeline/${studentId}/preview_pipeline/`, {
    headers: withAuthHeaders(accessToken),
  });

export const fetchGovernanceTabulations = (
  accessToken: string,
): Promise<GovernanceTabulationsResponse> =>
  getJson<GovernanceTabulationsResponse>('/api/core/api/admin/governance/tabulations/', {
    headers: withAuthHeaders(accessToken),
  });

export const fetchGovernanceActivity = (
  accessToken: string,
  limit = 50,
): Promise<{ items: GovernanceActivityItem[]; count: number }> =>
  getJson<{ items: GovernanceActivityItem[]; count: number }>(
    withQuery('/api/core/api/admin/governance/activity/', { limit }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );

export const fetchGovernanceReports = async (
  accessToken: string,
): Promise<GovernanceReportRecord[]> => {
  const payload = await getJson<ListPayload<GovernanceReportRecord>>(
    '/api/core/api/admin/governance/reports/',
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const generateGovernanceReport = (
  accessToken: string,
  payload: GovernanceReportGeneratePayload,
): Promise<GovernanceReportRecord> =>
  postJson<GovernanceReportRecord>('/api/core/api/admin/governance/reports/generate/', accessToken, payload);

export const fetchGovernanceReportCsv = async (
  accessToken: string,
  reportId: number,
): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/api/core/api/admin/governance/reports/${reportId}/download-csv/`, {
      headers: withAuthHeaders(accessToken),
    });
    if (!response.ok) {
      await handleResponse<unknown>(response);
    }
    return response.text();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const fetchGovernanceSchedules = async (
  accessToken: string,
): Promise<GovernanceSchedule[]> => {
  const payload = await getJson<ListPayload<GovernanceSchedule>>(
    '/api/core/api/admin/governance/schedules/',
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const createGovernanceSchedule = (
  accessToken: string,
  payload: Partial<GovernanceSchedule> & {
    name: string;
    report_type: string;
    frequency: string;
    next_run_at: string;
  },
): Promise<GovernanceSchedule> =>
  postJson<GovernanceSchedule>('/api/core/api/admin/governance/schedules/', accessToken, payload);

export const runGovernanceScheduleNow = (
  accessToken: string,
  scheduleId: number,
): Promise<{ detail: string; report_record_id: number }> =>
  postJson<{ detail: string; report_record_id: number }>(
    `/api/core/api/admin/governance/schedules/${scheduleId}/run-now/`,
    accessToken,
    {},
  );

export const fetchGovernanceAuditLogs = async (
  accessToken: string,
  params?: { action?: string; target_table?: string; q?: string },
): Promise<GovernanceAuditLog[]> => {
  const payload = await getJson<ListPayload<GovernanceAuditLog>>(
    withQuery('/api/core/api/admin/governance/audit-logs/', {
      action: params?.action,
      target_table: params?.target_table,
      q: params?.q,
    }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchGovernanceAuditCsv = async (
  accessToken: string,
  params?: { action?: string; target_table?: string; q?: string },
): Promise<string> => {
  try {
    const response = await fetch(
      `${API_BASE}${withQuery('/api/core/api/admin/governance/audit-logs/download-csv/', {
        action: params?.action,
        target_table: params?.target_table,
        q: params?.q,
      })}`,
      {
        headers: withAuthHeaders(accessToken),
      },
    );
    if (!response.ok) {
      await handleResponse<unknown>(response);
    }
    return response.text();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_ERROR_HINT);
    }
    throw error;
  }
};

export const fetchGovernanceRiskFlags = async (
  accessToken: string,
  params?: { status?: string; severity?: string; flag_type?: string },
): Promise<GovernanceRiskFlag[]> => {
  const payload = await getJson<ListPayload<GovernanceRiskFlag>>(
    withQuery('/api/core/api/admin/governance/risk-flags/', {
      status: params?.status,
      severity: params?.severity,
      flag_type: params?.flag_type,
    }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const refreshGovernanceRiskFlags = (
  accessToken: string,
): Promise<{ detail: string; created_count: number; items: GovernanceRiskFlag[] }> =>
  postJson<{ detail: string; created_count: number; items: GovernanceRiskFlag[] }>(
    '/api/core/api/admin/governance/risk-flags/refresh/',
    accessToken,
    {},
  );

export const acknowledgeGovernanceRiskFlag = (
  accessToken: string,
  riskFlagId: number,
): Promise<GovernanceRiskFlag> =>
  postJson<GovernanceRiskFlag>(
    `/api/core/api/admin/governance/risk-flags/${riskFlagId}/acknowledge/`,
    accessToken,
    {},
  );

export const resolveGovernanceRiskFlag = (
  accessToken: string,
  riskFlagId: number,
  note?: string,
): Promise<GovernanceRiskFlag> =>
  postJson<GovernanceRiskFlag>(
    `/api/core/api/admin/governance/risk-flags/${riskFlagId}/resolve/`,
    accessToken,
    note ? { note } : {},
  );

export const fetchGovernanceApprovalRequests = async (
  accessToken: string,
  params?: { status?: string; action_type?: string },
): Promise<GovernanceApprovalRequest[]> => {
  const payload = await getJson<ListPayload<GovernanceApprovalRequest>>(
    withQuery('/api/core/api/admin/governance/approvals/', {
      status: params?.status,
      action_type: params?.action_type,
    }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const approveGovernanceRequest = (
  accessToken: string,
  approvalRequestId: number,
  payload?: { comment?: string; role?: string },
): Promise<GovernanceApprovalRequest> =>
  postJson<GovernanceApprovalRequest>(
    `/api/core/api/admin/governance/approvals/${approvalRequestId}/approve/`,
    accessToken,
    payload ?? {},
  );

export const rejectGovernanceRequest = (
  accessToken: string,
  approvalRequestId: number,
  payload?: { comment?: string },
): Promise<GovernanceApprovalRequest> =>
  postJson<GovernanceApprovalRequest>(
    `/api/core/api/admin/governance/approvals/${approvalRequestId}/reject/`,
    accessToken,
    payload ?? {},
  );

export const fetchGovernancePolicy = (accessToken: string): Promise<GovernancePolicy> =>
  getJson<GovernancePolicy>('/api/core/api/admin/governance/policy/', {
    headers: withAuthHeaders(accessToken),
  });

export const updateGovernancePolicy = (
  accessToken: string,
  payload: Partial<GovernancePolicy>,
): Promise<GovernancePolicy> =>
  putJson<GovernancePolicy>('/api/core/api/admin/governance/policy/', accessToken, payload);

export const fetchGovernanceAlertPolicies = async (
  accessToken: string,
): Promise<GovernanceAlertPolicy[]> => {
  const payload = await getJson<ListPayload<GovernanceAlertPolicy>>(
    '/api/core/api/admin/governance/alert-policies/',
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const createGovernanceAlertPolicy = (
  accessToken: string,
  payload: {
    role: string;
    metric_key: string;
    warning_threshold: number;
    critical_threshold: number;
    is_active?: boolean;
  },
): Promise<GovernanceAlertPolicy> =>
  postJson<GovernanceAlertPolicy>(
    '/api/core/api/admin/governance/alert-policies/',
    accessToken,
    payload,
  );

export type LecturerClassSummary = {
  unit_id: number;
  unit_code: string;
  unit_title: string;
  programme_name: string;
  year_hint: number;
  students: number;
  guardians: number;
  pending_to_issue: number;
  pending_to_mark: number;
  pending_messages: number;
  term_progress_percent: number;
};

export type LecturerClassesDashboard = {
  lecturer: {
    id: number;
    username: string;
    display_name: string;
  };
  totals: {
    classes: number;
    pending_to_issue: number;
    pending_to_mark: number;
    pending_messages: number;
  };
  classes: LecturerClassSummary[];
};

export type LecturerStudentAssessment = {
  assignment_id: number;
  assignment_title: string;
  assessment_type: string;
  assessment_mode: string;
  status: string;
  grade: string | number | null;
};

export type LecturerClassStudent = {
  student_user_id: number;
  student_name: string;
  year: number;
  trimester: number;
  guardians: Array<{
    guardian_user_id: number;
    guardian_name: string;
    relationship: string;
  }>;
  assessment_summary: {
    done: number;
    missed: number;
    total: number;
  };
  assessments: LecturerStudentAssessment[];
};

export type LecturerClassDetail = {
  class: {
    unit_id: number;
    unit_code: string;
    unit_title: string;
    programme_name: string;
  };
  pending: {
    notes_or_assessments_to_issue: number;
    submissions_to_mark: number;
    messages_waiting_response: number;
  };
  students: LecturerClassStudent[];
};

export type WeeklyPlanAssessmentType = 'assignment' | 'cat';
export type WeeklyPlanAssessmentMode = 'oral' | 'physical' | 'mixed' | string;

export type WeeklyPlanItem = {
  assignment_id: number;
  title: string;
  due_at: string;
  assessment_type: WeeklyPlanAssessmentType;
  assessment_mode: WeeklyPlanAssessmentMode;
  material_links: string[];
  notes: string;
};

export type WeeklyPlanBucket = {
  week_start: string;
  items: WeeklyPlanItem[];
};

export type WeeklyPlanPublishItem = {
  title: string;
  due_at: string;
  assessment_type: WeeklyPlanAssessmentType;
  assessment_mode: WeeklyPlanAssessmentMode;
  material_links?: string[];
  notes?: string;
};

export type WeeklyPlanPublishResponse = {
  detail: string;
  week_start: string;
  created_assignment_ids: number[];
};

export type AttendanceRow = {
  student_user_id: number;
  present: boolean;
  notes?: string;
};

export type AttendanceSheetSummary = {
  sheet_id: number;
  week_start: string;
  unit_id: number;
  unit_code: string;
  rows: AttendanceRow[];
  uploaded_at: string;
};

export type ClassCallSummary = {
  id: number;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  source_id: string;
  meeting_url: string;
  unit_id: number;
  unit_code: string;
  unit_title: string;
};

export type ClassCallScheduleResponse = {
  detail: string;
  source_id: string;
  meeting_url: string;
  participant_count: number;
  unit: {
    id: number;
    code: string;
    title: string;
  };
};

export type ClassCallSchedulePayload = {
  unit_id: number;
  start_at: string;
  end_at: string;
  title?: string;
  description?: string;
  include_guardians?: boolean;
  participant_user_ids?: number[];
};

export type ClassCommunitySummary = {
  chatroom_id: number;
  unit_id: number;
  unit_code: string;
  unit_title: string;
  programme_name: string;
  students_count: number;
  lecturers_count: number;
  upcoming_call: {
    source_id: string;
    meeting_url: string;
    start_at: string;
    end_at: string;
    title: string;
  } | null;
};

export type ClassCommunityMessage = {
  id: number;
  chatroom: number;
  author_user: number;
  author_detail?: ApiUser;
  message: string;
  created_at: string;
};

export type HodCourseMatrixCourse = {
  unit_id: number;
  unit_code: string;
  unit_title: string;
  lecturer: {
    lecturer_user_id: number;
    lecturer_name: string;
  } | null;
  student_count: number;
  students: Array<{
    student_user_id: number;
    student_name: string;
  }>;
};

export type HodCourseMatrixYear = {
  study_year: number;
  courses: HodCourseMatrixCourse[];
};

export type HodCourseMatrix = {
  department: {
    id: number;
    name: string;
    code: string;
  };
  academic_year: number;
  trimester: number | null;
  years: HodCourseMatrixYear[];
  offerings: Array<{
    term_offering_id: number;
    programme_id: number;
    programme_name: string;
    unit_id: number;
    unit_code: string;
    unit_title: string;
    trimester: number;
    capacity: number | null;
    lecturer_user_id: number | null;
    lecturer_name: string | null;
  }>;
};

export const fetchLecturerClassesDashboard = (
  accessToken: string,
): Promise<LecturerClassesDashboard> =>
  getJson<LecturerClassesDashboard>('/api/learning/lecturer/classes/', {
    headers: withAuthHeaders(accessToken),
  });

export const fetchLecturerClassDetail = (
  accessToken: string,
  unitId: number,
): Promise<LecturerClassDetail> =>
  getJson<LecturerClassDetail>(`/api/learning/lecturer/classes/${unitId}/`, {
    headers: withAuthHeaders(accessToken),
  });

export const scheduleClassCall = (
  accessToken: string,
  payload: ClassCallSchedulePayload,
): Promise<ClassCallScheduleResponse> =>
  postJson<ClassCallScheduleResponse>('/api/communications/class-calls/schedule/', accessToken, payload);

export const fetchClassCalls = async (
  accessToken: string,
  scope: 'upcoming' | 'past' = 'upcoming',
): Promise<ClassCallSummary[]> => {
  const payload = await getJson<ListPayload<ClassCallSummary>>(
    withQuery('/api/communications/class-calls/', { scope }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const fetchClassCommunities = async (
  accessToken: string,
): Promise<ClassCommunitySummary[]> => {
  const payload = await getJson<ListPayload<ClassCommunitySummary>>('/api/communications/class-communities/', {
    headers: withAuthHeaders(accessToken),
  });
  return normalizeList(payload);
};

export const fetchClassCommunityMessages = async (
  accessToken: string,
  chatroomId: number,
): Promise<ClassCommunityMessage[]> => {
  const payload = await getJson<ListPayload<ClassCommunityMessage>>(
    withQuery('/api/communications/chat-messages/', { chatroom: chatroomId }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const createClassCommunityMessage = (
  accessToken: string,
  payload: { chatroom: number; message: string },
): Promise<ClassCommunityMessage> =>
  postJson<ClassCommunityMessage>('/api/communications/chat-messages/', accessToken, payload);

export const fetchHodCourseMatrix = (
  accessToken: string,
  departmentId: number,
  params?: { academic_year?: number; trimester?: number },
): Promise<HodCourseMatrix> =>
  getJson<HodCourseMatrix>(
    withQuery(`/api/core/api/departments/${departmentId}/course_matrix/`, {
      academic_year: params?.academic_year,
      trimester: params?.trimester,
    }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );

export const fetchLecturerWeeklyPlanner = async (
  accessToken: string,
  unitId: number,
): Promise<WeeklyPlanBucket[]> => {
  const payload = await getJson<ListPayload<WeeklyPlanBucket>>(
    withQuery('/api/learning/lecturer/weekly-planner/', { unit_id: unitId }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const publishLecturerWeeklyPlanner = (
  accessToken: string,
  payload: {
    unit_id: number;
    week_start: string;
    items: WeeklyPlanPublishItem[];
  },
): Promise<WeeklyPlanPublishResponse> =>
  postJson<WeeklyPlanPublishResponse>('/api/learning/lecturer/weekly-planner/', accessToken, payload);

export const fetchLecturerAttendanceSheets = async (
  accessToken: string,
  unitId: number,
): Promise<AttendanceSheetSummary[]> => {
  const payload = await getJson<ListPayload<AttendanceSheetSummary>>(
    withQuery('/api/learning/lecturer/attendance-sheet/', { unit_id: unitId }),
    {
      headers: withAuthHeaders(accessToken),
    },
  );
  return normalizeList(payload);
};

export const uploadLecturerAttendanceSheet = (
  accessToken: string,
  payload: {
    unit_id: number;
    week_start: string;
    rows: AttendanceRow[];
  },
): Promise<{ detail: string; sheet_id: number; unit_id: number; week_start: string }> =>
  postJson<{ detail: string; sheet_id: number; unit_id: number; week_start: string }>(
    '/api/learning/lecturer/attendance-sheet/',
    accessToken,
    payload,
  );
