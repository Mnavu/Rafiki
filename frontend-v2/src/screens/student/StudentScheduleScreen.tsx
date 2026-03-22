import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchStudentProfile,
  fetchStudentRegistrations,
  fetchStudentTimetable,
  type StudentProfile,
  type TimetableEntry,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const STUDENT_TIMETABLE_ALLOWED_STATUSES = ['submitted', 'pending_hod', 'approved'];

const dedupeByKey = <T,>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No schedule';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No schedule';
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const StudentScheduleScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { state, logout, updatePreferences } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(
    async (isRefresh = false) => {
      if (!state.accessToken || !state.user) {
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const nextProfile = profile ?? (await fetchStudentProfile(state.accessToken, state.user.id));
        setProfile(nextProfile);
        const [timetable, registrations] = await Promise.all([
          fetchStudentTimetable(state.accessToken, nextProfile.programme),
          fetchStudentRegistrations(state.accessToken),
        ]);
        const now = Date.now();
        const activeUnitIds = new Set(
          registrations
            .filter((registration) => STUDENT_TIMETABLE_ALLOWED_STATUSES.includes(registration.status))
            .map((registration) => registration.unit)
            .filter((unitId): unitId is number => typeof unitId === 'number'),
        );
        setEntries(
          dedupeByKey(
            timetable
            .filter((entry) => Date.parse(entry.end_datetime ?? '') >= now - 60 * 60 * 1000)
              .filter(
                (entry) =>
                  activeUnitIds.size === 0 ||
                  (typeof entry.unit === 'number' && activeUnitIds.has(entry.unit)),
              )
              .sort(
                (left, right) =>
                  Date.parse(left.start_datetime ?? '') - Date.parse(right.start_datetime ?? ''),
              ),
            (entry) => `${entry.unit ?? 'unit'}-${entry.start_datetime}-${entry.room}`,
          ),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load timetable.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile, state.accessToken, state.user],
  );

  useEffect(() => {
    loadEntries(false);
  }, [loadEntries]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading upcoming classes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEntries(true)} />}
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Student'}
          greeting="Upcoming classes"
          rightAccessory={<RoleBadge role="student" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Timetable error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Class list</Text>
          {entries.length ? (
            entries.map((entry) => (
              <DashboardTile
                key={`schedule-entry-${entry.id}`}
                icon={<MaterialCommunityIcons name="calendar-clock" size={26} color={palette.primary} />}
                title={`${entry.unit_code ?? `Unit ${entry.unit ?? ''}`}`.trim()}
                subtitle={`${entry.unit_title ?? 'Scheduled class'} | ${formatDateTime(entry.start_datetime)} | Room ${entry.room}`}
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="calendar-remove" size={26} color={palette.textSecondary} />}
              title="No upcoming classes"
              subtitle="Future timetable entries will appear here."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Class calls', onPress: () => navigation.navigate('StudentClassCalls') },
          { label: 'Refresh', onPress: () => loadEntries(true) },
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
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
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
});
