/**
 * Typed API client, mirroring Nanu's frontend-v2/src/services/api.ts
 * fetch-based pattern (no axios): small getJson/postJson helpers, a friendly
 * message on network failure, and one typed function per endpoint.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

const NETWORK_ERROR_HINT =
  "Could not reach the Beadwork Academy server. Check your connection and the API address.";

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = body?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}

async function request<T>(path: string, init: RequestInit, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    return await handleResponse<T>(response);
  } catch (err) {
    if (err instanceof TypeError) throw new Error(NETWORK_ERROR_HINT);
    throw err;
  }
}

function getJson<T>(path: string, token?: string | null): Promise<T> {
  return request<T>(path, { method: "GET" }, token);
}

function postJson<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  return request<T>(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    token
  );
}

function patchJson<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  return request<T>(
    path,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    token
  );
}

async function postMultipart<T>(path: string, form: FormData, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: form });
    return await handleResponse<T>(response);
  } catch (err) {
    if (err instanceof TypeError) throw new Error(NETWORK_ERROR_HINT);
    throw err;
  }
}

// ---------- types ----------

export type Role = "learner" | "mentor";

export type ApiUser = {
  id: number;
  username: string;
  role: Role;
  prefers_simple_language: boolean;
  prefers_high_contrast: boolean;
  speech_rate: number;
};

export type ModuleSummary = {
  id: number;
  code: string;
  title: string;
  summary: string;
  order: number;
  year_index: number;
  unlocks_after: number | null;
  lesson_count: number;
  locked: boolean;
  completed: boolean;
};

export type LessonSummary = {
  id: number;
  code: string;
  title: string;
  order: number;
  is_new_technique: boolean;
  estimated_minutes: number;
};

export type LessonStep = {
  id: number;
  order: number;
  caption: string;
  photo_url: string;
  image: string | null;
  is_checklist_item: boolean;
};

export type Milestone = {
  id: number;
  code: string;
  title: string;
  instructions_for_learner: string;
  requires_video: boolean;
  module: number | null;
  lesson: number | null;
};

export type LessonDetail = LessonSummary & {
  instructions_text: string;
  intro_video_url: string;
  steps: LessonStep[];
  milestones: Milestone[];
};

export type LearnerLessonProgress = {
  id: number;
  lesson_code: string;
  module_code: string;
  steps_completed: number;
  steps_total: number;
  status: "not_started" | "in_progress" | "completed";
  completed_at: string | null;
};

export type ProgressSummary = {
  completed_lessons: number;
  total_lessons: number;
  steps_completed: number;
  steps_total: number;
  lessons: LearnerLessonProgress[];
};

export type MilestoneSubmission = {
  id: number;
  learner: number;
  learner_username: string;
  milestone: number;
  milestone_title: string;
  photo: string | null;
  video: string | null;
  learner_note_text: string;
  learner_audio: string | null;
  learner_audio_transcript: string;
  status: "pending" | "approved" | "needs_changes";
  first_submitted_at: string;
  last_submitted_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  feedback_text: string;
  feedback_audio: string | null;
};

export type Award = {
  id: number;
  points: number;
  reason: string;
  badge: number | null;
  badge_title: string;
  created_at: string;
};

export type RewardsSummary = {
  stars: number;
  history: Award[];
  earned_badge_ids: number[];
};

export type Badge = {
  id: number;
  code: string;
  title: string;
  description: string;
  icon_url: string;
  criteria_hint: string;
};

export type NotificationItem = {
  id: number;
  verb: string;
  submission: number | null;
  created_at: string;
  read_at: string | null;
};

export type LinkedLearner = {
  learner_id: number;
  learner_username: string;
};

// ---------- auth ----------

export async function login(username: string, password: string): Promise<{ access: string; refresh: string }> {
  return postJson("/api/auth/login/", { username, password });
}

export async function fetchMe(token: string): Promise<ApiUser> {
  return getJson("/api/accounts/me/", token);
}

export async function updateMe(token: string, patch: Partial<ApiUser>): Promise<ApiUser> {
  return patchJson("/api/accounts/me/", patch, token);
}

export async function fetchMentorLearners(token: string): Promise<LinkedLearner[]> {
  return getJson("/api/accounts/mentor/learners/", token);
}

// ---------- curriculum ----------

export async function fetchModules(token: string): Promise<ModuleSummary[]> {
  return getJson("/api/curriculum/modules/", token);
}

export async function fetchModuleLessons(token: string, moduleCode: string): Promise<LessonSummary[]> {
  return getJson(`/api/curriculum/modules/${moduleCode}/lessons/`, token);
}

export async function fetchLessonDetail(token: string, lessonCode: string): Promise<LessonDetail> {
  return getJson(`/api/curriculum/lessons/${lessonCode}/`, token);
}

// ---------- practice ----------

export async function completeChecklistStep(
  token: string,
  stepId: number,
  learnerId?: number
): Promise<{ lesson_step_id: number; practice_count: number; completed_at: string }> {
  return postJson(`/api/practice/checklist/${stepId}/complete/`, learnerId ? { learner_id: learnerId } : {}, token);
}

export async function fetchMyProgress(token: string): Promise<ProgressSummary> {
  return getJson("/api/practice/progress/", token);
}

export type StepStatusMap = Record<string, { completed: boolean; practice_count: number }>;

export async function fetchLessonStepStatus(token: string, lessonCode: string): Promise<StepStatusMap> {
  return getJson(`/api/practice/lessons/${lessonCode}/step-status/`, token);
}

export async function fetchLearnerProgressForMentor(token: string, learnerId: number): Promise<ProgressSummary> {
  return getJson(`/api/practice/progress/${learnerId}/`, token);
}

// ---------- submissions ----------

export async function submitMilestone(
  token: string,
  milestoneId: number,
  fields: { noteText?: string; photoUri?: string; videoUri?: string; audioUri?: string }
): Promise<MilestoneSubmission> {
  const form = new FormData();
  if (fields.noteText) form.append("learner_note_text", fields.noteText);
  if (fields.photoUri) {
    form.append("photo", { uri: fields.photoUri, name: "milestone-photo.jpg", type: "image/jpeg" } as unknown as Blob);
  }
  if (fields.videoUri) {
    form.append("video", { uri: fields.videoUri, name: "milestone-video.mp4", type: "video/mp4" } as unknown as Blob);
  }
  if (fields.audioUri) {
    form.append("learner_audio", { uri: fields.audioUri, name: "milestone-note.wav", type: "audio/wav" } as unknown as Blob);
  }
  return postMultipart(`/api/submissions/milestones/${milestoneId}/submit/`, form, token);
}

export async function fetchMySubmissions(token: string): Promise<MilestoneSubmission[]> {
  return getJson("/api/submissions/mine/", token);
}

export async function fetchMentorInbox(token: string): Promise<MilestoneSubmission[]> {
  return getJson("/api/submissions/inbox/", token);
}

export async function fetchSubmissionDetail(token: string, submissionId: number): Promise<MilestoneSubmission> {
  return getJson(`/api/submissions/${submissionId}/`, token);
}

export async function reviewSubmission(
  token: string,
  submissionId: number,
  review: { status: "approved" | "needs_changes"; feedbackText?: string; awardPoints?: number; badgeCode?: string }
): Promise<{ id: number; status: string; reviewed_at: string }> {
  return postJson(
    `/api/submissions/${submissionId}/review/`,
    {
      status: review.status,
      feedback_text: review.feedbackText ?? "",
      award_points: review.awardPoints ?? 0,
      badge_code: review.badgeCode ?? "",
    },
    token
  );
}

// ---------- rewards ----------

export async function fetchMyRewards(token: string): Promise<RewardsSummary> {
  return getJson("/api/rewards/mine/", token);
}

export async function fetchBadgeCatalog(token: string): Promise<Badge[]> {
  return getJson("/api/rewards/badges/", token);
}

// ---------- notifications ----------

export async function fetchMyNotifications(token: string): Promise<NotificationItem[]> {
  return getJson("/api/notifications/mine/", token);
}

export async function markNotificationsRead(token: string): Promise<{ marked_read: boolean }> {
  return postJson("/api/notifications/mine/", {}, token);
}

// ---------- media ----------

export async function transcribeAudio(token: string, audioUri: string): Promise<{ text: string; confidence: number }> {
  const form = new FormData();
  form.append("audio", { uri: audioUri, name: "voice-note.wav", type: "audio/wav" } as unknown as Blob);
  return postMultipart("/api/media/transcribe/", form, token);
}
