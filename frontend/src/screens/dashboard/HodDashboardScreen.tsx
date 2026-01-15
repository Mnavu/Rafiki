import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl, Text, ActivityIndicator } from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  BottomUtilityBar,
  FloatingAssistantButton,
  AlertBanner,
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
import {
  fetchHodDepartment,
  fetchDepartmentLecturers,
  fetchDepartmentProgrammes,
  fetchDepartmentStudents,
  ApiStudent,
} from '@services/api';

type HodTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const hodTiles: HodTile[] = [
  {
    key: 'assignments',
    title: 'Course Assignments',
    subtitle: 'Allocate lecturers and review conflicts.',
    icon: 'swap-horizontal',
    navigateTo: 'HodAssignments',
  },
  {
    key: 'timetable',
    title: 'Timetables',
    subtitle: 'Approve weekly schedules with clash detection.',
    icon: 'calendar',
    navigateTo: 'HodTimetable',
  },
  {
    key: 'performance',
    title: 'Performance',
    subtitle: 'Monitor averages and pass rates.',
    icon: 'trending-up',
    navigateTo: 'HodPerformance',
  },
  {
    key: 'communications',
    title: 'Communications',
    subtitle: 'Broadcast to parents and lecturers.',
    icon: 'mail',
    navigateTo: 'HodCommunications',
  },
  {
    key: 'reports',
    title: 'Reports',
    subtitle: 'Generate PDF & CSV summaries.',
    icon: 'document',
    navigateTo: 'HodReports',
  },
];

export const HodDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state } = useAuth();
  const token = state.accessToken;
  const hodId = state.user?.id;
  const { refreshing, onRefresh: onRefreshPull } = usePullToRefresh();
  const [showAssistant, setShowAssistant] = useState(false);

  const [department, setDepartment] = useState<any>(null);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [studentsByYear, setStudentsByYear] = useState<Record<string, ApiStudent[]>>({});
  const [loading, setLoading] = useState(false);

  const groupStudentsByYear = (students: ApiStudent[]) => {
    return students.reduce((acc, student) => {
      const year = `Year ${student.year}`;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(student);
      return acc;
    }, {} as Record<string, ApiStudent[]>);
  };

  const loadData = useCallback(async () => {
    if (token && hodId) {
      setLoading(true);
      try {
        const hod = await fetchHodDepartment(token, hodId);
        if (hod?.department) {
          setDepartment(hod.department);
          const [lects, progs, studs] = await Promise.all([
            fetchDepartmentLecturers(token, hod.department.id),
            fetchDepartmentProgrammes(token, hod.department.id),
            fetchDepartmentStudents(token, hod.department.id),
          ]);
          setLecturers(lects);
          setProgrammes(progs);
          setStudentsByYear(groupStudentsByYear(studs));
        }
      } catch (err) {
        console.error('Failed to load HOD dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
  }, [token, hodId]);

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
        <GreetingHeader name={state.user?.display_name || 'HOD'} />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        <AlertBanner message="Conflict: CS202 overlaps with ENG110" variant="danger" />

        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>Department Overview</Text>
          {loading ? (
            <ActivityIndicator color={palette.primary} />
          ) : department ? (
            <View>
              <Text style={styles.deptName}>{department.name}</Text>
              <Text>Programmes: {programmes.length}</Text>
              <Text>Lecturers: {lecturers.length}</Text>
              {Object.entries(studentsByYear).map(([year, students]) => (
                <View key={year}>
                  <Text style={styles.yearTitle}>{year}</Text>
                  {students.map(student => (
                    <Text key={student.user.id}>{student.user.display_name}</Text>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text>No department information available.</Text>
          )}
        </View>

        <View style={styles.tiles}>
          {hodTiles.map((tile) => (
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
      <FloatingAssistantButton onPress={() => setShowAssistant(true)} />
      <BottomUtilityBar
        items={[
          { label: 'Home', isActive: true },
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
  overviewSection: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
  deptName: {
    ...typography.body,
    fontWeight: 'bold',
  },
  yearTitle: {
    ...typography.headingS,
    marginTop: spacing.md,
  },
});
