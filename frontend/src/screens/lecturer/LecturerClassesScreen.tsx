/* eslint jsx-quotes: "off" */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton, AlertBanner } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import {
  fetchCourses,
  fetchCourseRoster,
  submitAttendanceEvent,
  createDirectMessage,
  type ApiCourse,
  type CourseRoster,
} from '@services/api';

const sessions = [
  {
    time: '08:00',
    course: 'ICT201',
    topic: 'Networks & Internet',
    students: 24,
    location: 'B-302',
    action: 'Start attendance',
  },
  {
    time: '11:00',
    course: 'ICT305',
    topic: 'Assistive Tech Workshop',
    students: 18,
    location: 'Innovation Lab',
    action: 'Launch live class',
  },
  {
    time: '14:30',
    course: 'Advisory',
    topic: 'One-on-one check-ins',
    students: 6,
    location: 'Counseling Room',
    action: 'Open notes',
  },
];

export const LecturerClassesScreen: React.FC = () => {
  const { state } = useAuth();
  const token = state.accessToken;
  const lecturerId = state.user?.id;
  const navigation = useNavigation();

  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [rosters, setRosters] = useState<Record<number, CourseRoster | null>>({});
  const [rosterLoadingId, setRosterLoadingId] = useState<number | null>(null);
  const [attendanceMarked, setAttendanceMarked] = useState<Record<number, Record<number, boolean>>>(
    {},
  );
  const [attendanceProcessingKey, setAttendanceProcessingKey] = useState<string | null>(null);
  const [upcomingMessage, setUpcomingMessage] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    if (!token || !lecturerId) {
      return;
    }
    try {
      setLoadingCourses(true);
      setCourseError(null);
      const data = await fetchCourses(token);
      const owned = data.filter((course) => course.lecturer === lecturerId);
      setCourses(owned);
    } catch (error: any) {
      console.warn('Failed to load courses', error);
      setCourseError(error?.message ?? 'Unable to load your classes.');
    } finally {
      setLoadingCourses(false);
    }
  }, [lecturerId, token]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Simple 15-minute reminder based on today's static sessions list
  useEffect(() => {
    const computeReminder = () => {
      const now = new Date();
      for (const s of sessions) {
        const [hh, mm] = s.time.split(':').map((v) => parseInt(v, 10));
        const sessionTime = new Date();
        sessionTime.setHours(hh, mm, 0, 0);
        const diffMs = sessionTime.getTime() - now.getTime();
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin <= 15 && diffMin >= 0) {
          setUpcomingMessage(`Start ${s.course} (${s.topic}) in ${diffMin} minute${diffMin === 1 ? '' : 's'}`);
          return;
        }
      }
      setUpcomingMessage(null);
    };
    computeReminder();
    const id = setInterval(computeReminder, 60000);
    return () => clearInterval(id);
  }, []);

  const handleLoadRoster = async (courseId: number) => {
    if (!token) {
      return;
    }
    try {
      setRosterLoadingId(courseId);
      const data = await fetchCourseRoster(token, courseId);
      setRosters((prev) => ({ ...prev, [courseId]: data }));
    } catch (error: any) {
      console.warn('Failed to load roster', error);
      Alert.alert('Roster unavailable', error?.message ?? 'Unable to load roster right now.');
    } finally {
      setRosterLoadingId(null);
    }
  };

  const markStudentAttendance = async (
    courseId: number,
    studentId: number,
    enrollmentId: number,
  ) => {
    if (!token) {
      return;
    }
    const key = `${courseId}:${studentId}`;
    try {
      setAttendanceProcessingKey(key);
      await submitAttendanceEvent(token, {
        enrollment_id: enrollmentId,
        event_type: 'lecturer_mark',
      });
      setAttendanceMarked((prev) => {
        const current = prev[courseId] ? { ...prev[courseId] } : {};
        current[studentId] = true;
        return { ...prev, [courseId]: current };
      });
      Alert.alert('Attendance saved', 'Student marked present and queued for rewards.');
    } catch (error: any) {
      console.warn('Attendance mark failed', error);
      Alert.alert('Unable to mark attendance', error?.message ?? 'Please try again.');
    } finally {
      setAttendanceProcessingKey(null);
    }
  };

  const handleDirectMessage = async (studentId: number) => {
    if (!token) {
      return;
    }
    try {
      const thread = await createDirectMessage(token, studentId);
      navigation.navigate('LecturerMessages', { threadId: thread.id });
    } catch (error: any) {
      console.warn('Failed to create direct message', error);
      Alert.alert('Error', 'Unable to start a conversation.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {upcomingMessage ? <AlertBanner message={upcomingMessage} variant='info' /> : null}
      <Text style={styles.title}>Today&apos;s Classes</Text>
      <Text style={styles.subtitle}>
        Tap any session to take attendance, share resources, or start a call.
      </Text>
      {sessions.map((session) => (
        <View key={session.course + session.time} style={styles.card}>
          <View style={styles.iconWrapper}>
            <Ionicons name='people' size={28} color={palette.primary} />
            <Text style={styles.studentCount}>{session.students}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>
              {session.course} - {session.topic}
            </Text>
            <Text style={styles.cardMeta}>
              {session.time} - {session.location}
            </Text>
            <VoiceButton label={session.action} onPress={() => {}} />
          </View>
        </View>
      ))}
      <VoiceButton label='Speak schedule' onPress={() => {}} />

      <View style={styles.rosterSection}>
        <Text style={styles.sectionTitle}>Course rosters</Text>
        <Text style={styles.helper}>
          Pull the latest enrollment list before marking attendance or awarding punctuality rewards.
        </Text>
        <VoiceButton label='Refresh courses' onPress={loadCourses} />
        {loadingCourses ? (
          <ActivityIndicator color={palette.primary} />
        ) : courseError ? (
          <Text style={styles.error}>{courseError}</Text>
        ) : courses.length === 0 ? (
          <Text style={styles.helper}>No courses are assigned to you yet.</Text>
        ) : (
          courses.map((course) => {
            const roster = rosters[course.id];
            const rosterLoaded = Boolean(roster);
            const studentCount = roster?.students.length ?? 0;
            return (
              <View key={course.id} style={styles.rosterCard}>
                <Text style={styles.cardTitle}>
                  {course.code} - {course.name}
                </Text>
                <Text style={styles.cardMeta}>
                  {rosterLoaded ? `${studentCount} students enrolled` : 'Roster not loaded yet'}
                </Text>
                <VoiceButton
                  label={
                    rosterLoadingId === course.id
                      ? 'Loading roster...'
                      : rosterLoaded
                      ? 'Refresh roster'
                      : 'Load roster'
                  }
                  onPress={rosterLoadingId ? undefined : () => handleLoadRoster(course.id)}
                />
                {rosterLoaded ? (
                  <View style={styles.rosterList}>
                    {roster!.students.map((student) => {
                      const marked = attendanceMarked[course.id]?.[student.id];
                      const key = `${course.id}:${student.id}`;
                      return (
                        <View key={student.id} style={styles.rosterStudentRow}>
                          <Text style={styles.rosterStudent}>
                            {student.display_name || student.username}
                          </Text>
                           <VoiceButton
                            label="Text"
                            onPress={() => handleDirectMessage(student.id)}
                          />
                          <VoiceButton
                            label={
                              marked
                                ? 'Marked'
                                : attendanceProcessingKey === key
                                ? 'Marking...'
                                : 'Mark present'
                            }
                            onPress={
                              marked || attendanceProcessingKey
                                ? undefined
                                : () =>
                                    markStudentAttendance(
                                      course.id,
                                      student.id,
                                      student.enrollment_id,
                                    )
                            }
                          />
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.helper}>
                    Tap load roster to pull the latest enrollment data.
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: palette.background,
  },
  title: {
    ...typography.headingXL,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
  },
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
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCount: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  cardBody: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  cardMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  rosterSection: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.headingL,
    color: palette.textPrimary,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  error: {
    ...typography.body,
    color: palette.danger,
  },
  rosterCard: {
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
  rosterList: {
    gap: spacing.sm,
  },
  rosterStudent: {
    ...typography.body,
    color: palette.textPrimary,
  },
  rosterStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
