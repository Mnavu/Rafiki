import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert } from 'react-native';
import { Text } from '@components/Themed';
import { TileButton } from '@components/TileButton';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { API } from '@services/api';
import { Department, Programme, StudentProfile, LecturerProfile } from '../types/models';
import Colors from '@theme/Colors';

type HodDashboardScreenProps = StackScreenProps<RootStackParamList, 'Dashboard'>;

const HodDashboardScreen: React.FC<HodDashboardScreenProps> = ({ navigation }) => {
  const { state } = useAuth();
  const hodProfile = state.user?.hod_profile;
  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentProgrammes, setDepartmentProgrammes] = useState<Programme[]>([]);
  const [departmentLecturers, setDepartmentLecturers] = useState<LecturerProfile[]>([]);
  const [eligibleStudents, setEligibleStudents] = useState<StudentProfile[]>([]);

  // Fetch HOD's department
  const { data: departmentData } = useQuery<Department>(
    ['department', hodProfile?.department],
    () => API.getDepartment(hodProfile?.department as number), // Assuming an API endpoint for this
    {
      enabled: !!hodProfile?.department,
      onSuccess: (data) => setDepartment(data),
    }
  );

  // Fetch department programmes
  const { data: departmentProgrammesData } = useQuery<Programme[]>(
    ['departmentProgrammes', department?.id],
    () => API.getProgrammes({ department_id: department?.id }), // Reusing programmes API
    {
      enabled: !!department?.id,
      onSuccess: (data) => setDepartmentProgrammes(data),
    }
  );

  // Fetch department lecturers
  const { data: departmentLecturersData } = useQuery<LecturerProfile[]>(
    ['departmentLecturers', department?.id],
    () => API.getDepartmentLecturers(department?.id as number), // Assuming an API endpoint for this
    {
      enabled: !!department?.id,
      onSuccess: (data) => setDepartmentLecturers(data),
    }
  );

  // Fetch eligible students for registration approval
  const { data: eligibleStudentsData } = useQuery<StudentProfile[]>(
    ['eligibleStudents', department?.id],
    () => API.getEligibleStudents({ department_id: department?.id }), // Assuming an API endpoint for this
    {
      enabled: !!department?.id,
      onSuccess: (data) => setEligibleStudents(data),
    }
  );

  useEffect(() => {
    if (departmentData) {setDepartment(departmentData);}
    if (departmentProgrammesData) {setDepartmentProgrammes(departmentProgrammesData);}
    if (departmentLecturersData) {setDepartmentLecturers(departmentLecturersData);}
    if (eligibleStudentsData) {setEligibleStudents(eligibleStudentsData);}
  }, [departmentData, departmentProgrammesData, departmentLecturersData, eligibleStudentsData]);

  if (!state.user || !hodProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading HOD Dashboard...</Text>
      </View>
    );
  }

  const handleApproveRegistrations = () => {
    Alert.alert('Approve Registrations', 'Functionality to approve student registrations.');
    // TODO: Implement navigation to registration approval screen
  };

  const handleAssignLecturers = () => {
    Alert.alert('Assign Lecturers', 'Functionality to assign lecturers to units.');
    // TODO: Implement navigation to lecturer assignment screen
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Welcome, {state.user.display_name || state.user.username}!</Text>
      {department && (
        <Text style={styles.departmentBadge}>Department: {department.name} ({department.code})</Text>
      )}

      <Text style={styles.sectionTitle}>Department Overview</Text>
      <View style={styles.overviewCard}>
        <Text>Total Programmes: {departmentProgrammes.length}</Text>
        <Text>Total Lecturers: {departmentLecturers.length}</Text>
        <Text>Eligible Students for Approval: {eligibleStudents.length}</Text>
      </View>

      <View style={styles.tilesContainer}>
        <TileButton title="Approve Registrations" onPress={handleApproveRegistrations} icon="checkmark-circle" />
        <TileButton title="Assign Lecturers" onPress={handleAssignLecturers} icon="person-add" />
        <TileButton title="Timetable Manager" onPress={() => navigation.navigate('HodTimetable')} icon="calendar" />
        <TileButton title="Department Reports" onPress={() => navigation.navigate('HodReports')} icon="document-text" />
        <TileButton title="Communications" onPress={() => navigation.navigate('HodCommunications')} icon="chatbubbles" />
        <TileButton title="Performance" onPress={() => navigation.navigate('HodPerformance')} icon="stats-chart" />
        {/* Add more HOD-specific tiles as needed */}
      </View>

      <Text style={styles.sectionTitle}>Students Pending Approval</Text>
      {eligibleStudents.length === 0 ? (
        <Text>No students currently pending registration approval.</Text>
      ) : (
        eligibleStudents.map((student) => (
          <View key={student.id} style={styles.studentItem}>
            <Text style={styles.studentName}>{student.user.display_name || student.user.username}</Text>
            <Text style={styles.studentDetails}>{student.programme.name}, Year {student.year}, Trimester {student.trimester}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.light.background,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: Colors.light.text,
  },
  departmentBadge: {
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: Colors.light.text,
  },
  overviewCard: {
    backgroundColor: Colors.light.cardBackground,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  studentItem: {
    backgroundColor: Colors.light.cardBackground,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  studentDetails: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 5,
  },
});

export default HodDashboardScreen;
