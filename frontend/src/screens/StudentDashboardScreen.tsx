import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert } from 'react-native';
import { Text } from '@components/Themed';
import { TileButton } from '@components/TileButton';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { API } from '@services/api';
import { Programme, Registration, CurriculumUnit } from '../types/models';
import Colors from '@theme/Colors';

type StudentDashboardScreenProps = StackScreenProps<RootStackParamList, 'Dashboard'>;

const StudentDashboardScreen: React.FC<StudentDashboardScreenProps> = ({ navigation }) => {
  const { state } = useAuth();
  const studentProfile = state.user?.student_profile;
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [offeredUnits, setOfferedUnits] = useState<CurriculumUnit[]>([]);

  // Fetch student's programme
  const { data: programmeData } = useQuery<Programme>(
    ['programme', studentProfile?.programme],
    () => API.getProgramme(studentProfile?.programme as number),
    {
      enabled: !!studentProfile?.programme,
      onSuccess: (data) => setProgramme(data),
    }
  );

  // Fetch student's registrations
  const { data: registrationsData } = useQuery<Registration[]>(
    ['registrations', studentProfile?.id],
    () => API.getRegistrations({ student_id: studentProfile?.id }),
    {
      enabled: !!studentProfile?.id,
      onSuccess: (data) => setRegistrations(data),
    }
  );

  // Fetch offered units (for registration)
  const { data: offeredUnitsData } = useQuery<CurriculumUnit[]>(
    ['offeredUnits', studentProfile?.programme, studentProfile?.year, studentProfile?.trimester],
    () => API.getTermOfferings({
      programme_id: studentProfile?.programme,
      year: studentProfile?.year,
      trimester: studentProfile?.trimester,
    }),
    {
      enabled: !!studentProfile?.programme && !!studentProfile?.year && !!studentProfile?.trimester,
      select: (data) => data.filter(unit => unit.offered).map(unit => unit.unit), // Only show offered units
    }
  );

  useEffect(() => {
    if (programmeData) {setProgramme(programmeData);}
    if (registrationsData) {setRegistrations(registrationsData);}
    if (offeredUnitsData) {setOfferedUnits(offeredUnitsData);}
  }, [programmeData, registrationsData, offeredUnitsData]);

  if (!state.user || !studentProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Student Dashboard...</Text>
      </View>
    );
  }

  const handleRegisterUnits = () => {
    Alert.alert(
      'Register Units',
      'This functionality is not yet implemented. You would select units here.'
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Hello, {state.user.display_name || state.user.username}!</Text>
      {programme && (
        <Text style={styles.badge}>
          {programme.name} — Year {studentProfile.year}, Trimester {studentProfile.trimester} ({studentProfile.cohort_year})
        </Text>
      )}

      <View style={styles.tilesContainer}>
        <TileButton title="My Timetable" onPress={() => navigation.navigate('StudentTimetable')} icon="calendar" />
        <TileButton title="My Assignments" onPress={() => navigation.navigate('StudentAssignments')} icon="book" />
        <TileButton title="Chatbot Help" onPress={() => navigation.navigate('StudentCommunicate')} icon="chatbubbles" />
        <TileButton title="Library" onPress={() => navigation.navigate('StudentLibrary')} icon="library" />
      </View>

      <Text style={styles.sectionTitle}>My Registrations</Text>
      {registrations.length === 0 ? (
        <Text>No units registered yet.</Text>
      ) : (
        registrations.map((reg) => (
          <View key={reg.id} style={styles.registrationItem}>
            <Text>{reg.unit.title} ({reg.unit.code})</Text>
            <Text style={{ color: reg.status === 'approved' ? Colors.green : Colors.yellow }}>
              Status: {reg.status}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Available for Registration</Text>
      {offeredUnits.length === 0 ? (
        <Text>No units currently offered for your programme/trimester.</Text>
      ) : (
        <View>
          {offeredUnits.map((unit) => (
            <View key={unit.id} style={styles.offeredUnitItem}>
              <Text>{unit.title} ({unit.code})</Text>
              {unit.has_prereq && unit.prereq_unit && (
                <Text style={styles.warningText}>Requires: {unit.prereq_unit.code}</Text>
              )}
            </View>
          ))}
          <TileButton title="Register for Units" onPress={handleRegisterUnits} icon="add-circle" style={styles.registerButton} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Course Chatrooms</Text>
      <Text>Course chatrooms will appear here after registration approval.</Text>
      {/* TODO: Implement actual course chatroom listing based on approved registrations */}
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
  badge: {
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 20,
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: Colors.light.text,
  },
  registrationItem: {
    backgroundColor: Colors.light.cardBackground,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  offeredUnitItem: {
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
  warningText: {
    color: Colors.red,
    fontSize: 12,
    marginTop: 5,
  },
  registerButton: {
    marginTop: 20,
    backgroundColor: Colors.primary,
  },
});

export default StudentDashboardScreen;
