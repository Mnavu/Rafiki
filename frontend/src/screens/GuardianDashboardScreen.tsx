import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Text } from '@components/Themed';
import { TileButton } from '@components/TileButton';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { API } from '@services/api';
import { StudentProfile, Registration, FinanceStatus } from '../types/models';
import Colors from '@theme/Colors';

type GuardianDashboardScreenProps = StackScreenProps<RootStackParamList, 'Dashboard'>;

const GuardianDashboardScreen: React.FC<GuardianDashboardScreenProps> = ({ navigation }) => {
  const { state } = useAuth();
  const guardianProfile = state.user; // Assuming state.user is the Guardian's User object
  const [linkedStudents, setLinkedStudents] = useState<StudentProfile[]>([]);
  const [financeStatuses, setFinanceStatuses] = useState<{ [studentId: number]: FinanceStatus[] }>({});
  const [studentRegistrations, setStudentRegistrations] = useState<{ [studentId: number]: Registration[] }>({});

  // Fetch linked students
  useQuery<StudentProfile[]>(
    ['linkedStudents', guardianProfile?.id],
    () => API.getLinkedStudents(guardianProfile?.id as number), // Assuming an API endpoint for this
    {
      enabled: !!guardianProfile?.id,
      onSuccess: (data) => {
        setLinkedStudents(data);
        // Trigger finance and registration fetches for each linked student
        data.forEach(student => {
          fetchStudentFinanceStatus(student.id);
          fetchStudentRegistrations(student.id);
        });
      },
    }
  );

  const fetchStudentFinanceStatus = async (studentId: number) => {
    try {
      const data = await API.getFinanceStatus({ student_id: studentId }); // Assuming API call
      setFinanceStatuses(prev => ({ ...prev, [studentId]: data }));
    } catch (error) {
      console.error(`Failed to fetch finance status for student ${studentId}:`, error);
    }
  };

  const fetchStudentRegistrations = async (studentId: number) => {
    try {
      const data = await API.getRegistrations({ student_id: studentId }); // Reusing registration API
      setStudentRegistrations(prev => ({ ...prev, [studentId]: data }));
    } catch (error) {
      console.error(`Failed to fetch registrations for student ${studentId}:`, error);
    }
  };

  if (!state.user || !guardianProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Guardian Dashboard...</Text>
      </View>
    );
  }

  const getFinanceStatusColor = (status: FinanceStatus['status']) => {
    switch (status) {
      case 'paid': return Colors.green;
      case 'partial': return Colors.yellow;
      case 'pending': return Colors.red;
      default: return Colors.gray;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Hello, {state.user.display_name || state.user.username}!</Text>
      <Text style={styles.sectionTitle}>Linked Students</Text>
      {linkedStudents.length === 0 ? (
        <Text>No students linked yet.</Text>
      ) : (
        linkedStudents.map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <Text style={styles.studentName}>{student.user.display_name || student.user.username}</Text>
            <Text style={styles.studentProgramme}>{student.programme.name} — Year {student.year}, Trimester {student.trimester}</Text>

            <Text style={styles.subSectionTitle}>Financial Status:</Text>
            {(financeStatuses[student.id] || []).map((fs) => (
              <View key={fs.id} style={styles.financeItem}>
                <Text>Term {fs.academic_year}/T{fs.trimester}:</Text>
                <Text style={{ color: getFinanceStatusColor(fs.status) }}>
                  Status: {fs.status} (Bal: {fs.balance})
                </Text>
              </View>
            ))}

            <Text style={styles.subSectionTitle}>Registered Units:</Text>
            {(studentRegistrations[student.id] || []).map((reg) => (
              <View key={reg.id} style={styles.registrationItem}>
                <Text>{reg.unit.title} ({reg.unit.code})</Text>
                <Text style={{ color: reg.status === 'approved' ? Colors.green : Colors.yellow }}>
                  Status: {reg.status}
                </Text>
              </View>
            ))}

            <View style={styles.studentActions}>
              <TileButton title="View Progress" onPress={() => navigation.navigate('GuardianProgress', { studentId: student.id })} icon="stats-chart" small />
              <TileButton title="View Fees" onPress={() => navigation.navigate('GuardianFees', { studentId: student.id })} icon="wallet" small />
            </View>
          </View>
        ))
      )}

      <View style={styles.tilesContainer}>
        <TileButton title="My Messages" onPress={() => navigation.navigate('GuardianMessages')} icon="mail" />
        <TileButton title="Timetable" onPress={() => navigation.navigate('GuardianTimetable')} icon="calendar" />
        <TileButton title="Announcements" onPress={() => navigation.navigate('GuardianAnnouncements')} icon="megaphone" />
        {/* Add more Guardian-specific tiles as needed */}
      </View>
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
    marginBottom: 20,
    color: Colors.light.text,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: Colors.light.text,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: Colors.light.text,
  },
  studentCard: {
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
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 5,
  },
  studentProgramme: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 10,
  },
  financeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  registrationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  studentActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default GuardianDashboardScreen;
