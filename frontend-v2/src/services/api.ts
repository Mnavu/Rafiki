import type { Role } from '@types/roles';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

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

export const loginRequest = async (payload: LoginPayload): Promise<TokenResponse> => {
  const response = await fetch(`${API_BASE}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<TokenResponse>(response);
};

export const fetchProfile = async (accessToken: string): Promise<ApiUser> => {
  const response = await fetch(`${API_BASE}/api/users/me/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<ApiUser>(response);
};
