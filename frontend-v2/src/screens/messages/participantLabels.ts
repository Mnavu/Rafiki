import type { Role } from '@app-types/roles';
import type { ApiUser, CommunicationThread } from '@services/api';

type LabelOptions = {
  viewerUserId?: number | null;
  studentYearByUserId?: Record<number, number | null>;
  threadStudentName?: string;
  threadStudentYear?: number | null;
  lecturerUnitTitle?: string | null;
};

const getName = (user: ApiUser | null | undefined): string => {
  if (!user) {
    return 'Unknown user';
  }
  const display = user.display_name?.trim();
  if (display) {
    return display;
  }
  const first = user.first_name?.trim();
  const last = user.last_name?.trim();
  const names = `${first ?? ''} ${last ?? ''}`.trim();
  if (names) {
    return names;
  }
  return user.username;
};

const formatStudentLabel = (user: ApiUser, options: LabelOptions): string => {
  const year = options.studentYearByUserId?.[user.id] ?? options.threadStudentYear ?? null;
  return `${getName(user)} - Student${year ? ` Year ${year}` : ''}`;
};

const formatGuardianLabel = (user: ApiUser, options: LabelOptions): string => {
  const childName = options.threadStudentName;
  const year = options.threadStudentYear ?? null;
  const relation = childName ? ` to ${childName}` : '';
  const yearPart = year ? ` Year ${year}` : '';
  return `${getName(user)} - Guardian${relation}${yearPart}`;
};

const formatLecturerLabel = (user: ApiUser, options: LabelOptions): string => {
  const title = options.lecturerUnitTitle?.trim();
  return `${getName(user)} - Lecturer${title ? ` ${title}` : ''}`;
};

export const formatUserLabel = (
  user: ApiUser | null | undefined,
  options: LabelOptions = {},
): string => {
  if (!user) {
    return 'Unknown user';
  }
  if (user.role === 'student') {
    return formatStudentLabel(user, options);
  }
  if (user.role === 'parent') {
    return formatGuardianLabel(user, options);
  }
  if (user.role === 'lecturer') {
    return formatLecturerLabel(user, options);
  }
  return `${getName(user)} - ${user.role}`;
};

export const formatThreadTitle = (
  thread: CommunicationThread,
  viewerRole: Role,
  options: LabelOptions = {},
): string => {
  const studentName = getName(thread.student_detail);
  const studentYear = thread.student_detail
    ? options.studentYearByUserId?.[thread.student_detail.id] ?? null
    : null;
  const common = {
    ...options,
    threadStudentName: studentName,
    threadStudentYear: studentYear,
  };

  if (viewerRole === 'student') {
    if (
      thread.teacher_detail &&
      thread.student_detail &&
      thread.teacher_detail.role === 'student' &&
      options.viewerUserId
    ) {
      const counterpart =
        thread.student_detail.id === options.viewerUserId
          ? thread.teacher_detail
          : thread.student_detail;
      return formatUserLabel(counterpart, common);
    }
    if (thread.teacher_detail) {
      return formatUserLabel(thread.teacher_detail, common);
    }
  }
  if (viewerRole === 'parent') {
    if (thread.teacher_detail) {
      return formatUserLabel(thread.teacher_detail, common);
    }
    if (thread.student_detail) {
      return formatUserLabel(thread.student_detail, common);
    }
  }
  if (viewerRole === 'lecturer') {
    const student = thread.student_detail ? formatUserLabel(thread.student_detail, common) : null;
    const guardian = thread.parent_detail ? formatUserLabel(thread.parent_detail, common) : null;
    if (student && guardian) {
      return `${student} | ${guardian}`;
    }
    if (student) {
      return student;
    }
  }
  if (thread.subject?.trim()) {
    return thread.subject;
  }
  return `Thread #${thread.id}`;
};

export const buildParticipantTrack = (
  thread: CommunicationThread,
  options: LabelOptions = {},
): string[] => {
  const studentName = getName(thread.student_detail);
  const studentYear = thread.student_detail
    ? options.studentYearByUserId?.[thread.student_detail.id] ?? null
    : null;
  const common = {
    ...options,
    threadStudentName: studentName,
    threadStudentYear: studentYear,
  };
  const labels: string[] = [];
  if (thread.student_detail) {
    labels.push(formatUserLabel(thread.student_detail, common));
  }
  if (thread.parent_detail) {
    labels.push(formatUserLabel(thread.parent_detail, common));
  }
  if (thread.teacher_detail) {
    labels.push(formatUserLabel(thread.teacher_detail, common));
  }
  return labels;
};
