import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert } from 'react-native';
import { Text } from '@components/Themed';
import { TileButton } from '@components/TileButton';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { API } from '@services/api';
import { LecturerAssignment } from '../types/models';
import Colors from '@theme/Colors';

type LecturerDashboardScreenProps = StackScreenProps<RootStackParamList, 'Dashboard'>;

const LecturerDashboardScreen: React.FC<LecturerDashboardScreenProps> = ({ navigation }) => {
  const { state } = useAuth();
  const lecturerProfile = state.user?.lecturer_profile;
  const [assignedUnits, setAssignedUnits] = useState<LecturerAssignment[]>([]);

  // Fetch assigned units
  const { data: assignedUnitsData } = useQuery<LecturerAssignment[]>(
    ['assignedUnits', lecturerProfile?.id],
    () => API.getLecturerAssignments(lecturerProfile?.id as number), // Assuming an API endpoint for this
    {
      enabled: !!lecturerProfile?.id,
      onSuccess: (data) => setAssignedUnits(data),
    }
  );

  useEffect(() => {
    if (assignedUnitsData) {setAssignedUnits(assignedUnitsData);}
  }, [assignedUnitsData]);

  if (!state.user || !lecturerProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Lecturer Dashboard...</Text>
      </View>
    );
  }

  const handleCreateAssignment = () => {
    Alert.alert(
      'Create Assignment',
      'This functionality is not yet implemented. A date picker would be used here.'
    );
    // TODO: Implement navigation to assignment creation screen
  };

  const handleProvideFeedback = () => {
    Alert.alert(
      'Provide Feedback',
      'This functionality is not yet implemented. You would provide voice/video feedback here.'
    );
    // TODO: Implement navigation to submission feedback screen
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Hello, {state.user.display_name || state.user.username}!</Text>
      <Text style={styles.sectionTitle}>My Assigned Units</Text>
      {assignedUnits.length === 0 ? (
        <Text>No units assigned yet.</Text>
      ) : (
        assignedUnits.map((assignment) => (
          <View key={assignment.id} style={styles.assignedUnitItem}>
            <Text>{assignment.unit.title} ({assignment.unit.code})</Text>
            <Text style={styles.unitDetails}>
              {assignment.academic_year}/T{assignment.trimester}
            </Text>
          </View>
        ))
      )}
      {assignedUnits.length >= 3 && (
        <Text style={styles.warningText}>You have reached the maximum assigned units (3).</Text>
      )}

      <View style={styles.tilesContainer}>
        <TileButton title="Create Assignment" onPress={handleCreateAssignment} icon="add-circle" />
        <TileButton title="Provide Feedback" onPress={handleProvideFeedback} icon="chatbox-ellipses" />
        <TileButton title="Class List" onPress={() => navigation.navigate('LecturerClasses')} icon="people" />
        <TileButton title="My Timetable" onPress={() => navigation.navigate('LecturerTimetable')} icon="calendar" />
        <TileButton title="Messages" onPress={() => navigation.navigate('LecturerMessages')} icon="mail" />
        <TileButton title="Records" onPress={() => navigation.navigate('LecturerRecords')} icon="folder" />
      </View>

      {/* TODO: Implement class list and student management */}
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
  assignedUnitItem: {
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
  unitDetails: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 5,
  },
  warningText: {
    color: Colors.red,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  tilesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: 20,
  },
});

export default LecturerDashboardScreen;
