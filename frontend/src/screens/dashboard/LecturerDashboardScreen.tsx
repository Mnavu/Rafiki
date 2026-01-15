import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl, Text, ActivityIndicator } from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  FloatingAssistantButton,
  BottomUtilityBar,
  AlertBanner,
  NotificationBell,
  VoiceSearchBar,
  ChatWidget,
} from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { usePullToRefresh } from '@hooks/usePullToRefresh';
import { useAuth } from '@context/AuthContext';
import { fetchCourses, type ApiCourse } from '@services/api';

type LecturerTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const lecturerTiles: LecturerTile[] = [
  {
    key: 'classes',
    title: 'My Classes',
    subtitle: 'Start sessions and take attendance.',
    icon: 'people',
    navigateTo: 'LecturerClasses',
  },
  {
    key: 'assignments',
    title: 'Assignments',
    subtitle: 'Review submissions and send feedback.',
    icon: 'reader',
    navigateTo: 'LecturerAssignments',
  },
  {
    key: 'messages',
    title: 'Messages',
    subtitle: 'Respond to parents and students.',
    icon: 'chatbubbles',
    navigateTo: 'LecturerMessages',
  },
  {
    key: 'records',
    title: 'Records',
    subtitle: 'Update grades and attendance quickly.',
    icon: 'create',
    navigateTo: 'LecturerRecords',
  },
  {
    key: 'timetable',
    title: 'Timetable',
    subtitle: 'Plan sessions and toggle reminders.',
    icon: 'calendar',
    navigateTo: 'LecturerTimetable',
  },
  {
    key: 'rewards',
    title: 'Rewards Hub',
    subtitle: 'Celebrate teaching milestones.',
    icon: 'gift',
    navigateTo: 'Rewards',
  },
];

export const LecturerDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state } = useAuth();
  const token = state.accessToken;
  const lecturerId = state.user?.id;
  const { refreshing, onRefresh: onRefreshPull } = usePullToRefresh();
  const [showAssistant, setShowAssistant] = useState(false);
  const [myCourses, setMyCourses] = useState<ApiCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const loadData = useCallback(async () => {
    if (token && lecturerId) {
      setLoadingCourses(true);
      try {
        const data = await fetchCourses(token);
        const owned = data.filter(course => course.lecturer === lecturerId);
        setMyCourses(owned);
      } catch (err) {
        console.error("Failed to fetch lecturer's courses", err);
      } finally {
        setLoadingCourses(false);
      }
    }
  }, [token, lecturerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    onRefreshPull();
    loadData();
  }, [onRefreshPull, loadData]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
      >
        <GreetingHeader name={state.user?.display_name || 'Lecturer'} rightAccessory={<NotificationBell />} />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        <AlertBanner message="Start ICT201 session in 10 minutes" variant="info" />

        <View style={styles.myCoursesSection}>
          <Text style={styles.sectionTitle}>My Units</Text>
          {loadingCourses ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            myCourses.map(course => (
              <View key={course.id} style={styles.courseCard}>
                <Text style={styles.courseTitle}>{course.name}</Text>
                <Text style={styles.courseCode}>{course.code}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.tiles}>
          {lecturerTiles.map((tile) => (
            <DashboardTile
              key={tile.key}
              title={tile.title}
              subtitle={tile.subtitle}
              onPress={() => navigation.navigate(tile.navigateTo as never)}
              icon={<Ionicons name={tile.icon as any} size={28} color={palette.primary} />}
            />
          ))}
        </View>
      </ScrollView>
      <FloatingAssistantButton label="Assist" onPress={() => setShowAssistant(true)} />
      <BottomUtilityBar
        items={[
          { label: 'Home', isActive: true },
          { label: 'Rewards', onPress: () => navigation.navigate('Rewards') },
          { label: 'Search', onPress: () => navigation.navigate('Search') },
          { label: 'Profile', onPress: () => navigation.navigate('Profile') },
        ]}
      />
      {showAssistant ? <ChatWidget onClose={() => setShowAssistant(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: spacing.lg, paddingBottom: 160, gap: spacing.md },
  tiles: { gap: spacing.md },
  myCoursesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
  courseCard: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  courseTitle: {
    ...typography.body,
    fontWeight: 'bold',
    color: palette.textPrimary,
  },
  courseCode: {
    ...typography.helper,
    color: palette.textSecondary,
  },
});
