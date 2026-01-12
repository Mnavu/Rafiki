import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { registerForExams } from '@services/api';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

const assignmentsData = [
  {
    title: 'Photosynthesis Poster',
    due: new Date(new Date().setDate(new Date().getDate() + 1)),
    description: 'Record a 2 minute voice summary and add pictures.',
  },
  { 
    title: 'Number Patterns', 
    due: new Date(new Date().setDate(new Date().getDate() + 3)), 
    description: 'Complete worksheet pages 4-6.' 
  },
  { 
    title: 'World War I Essay', 
    due: new Date(new Date().setDate(new Date().getDate() + 1)), 
    description: 'Submit a 500-word essay.' 
  },
];

export const StudentAssignmentsScreen: React.FC = () => {
  const { state } = useAuth();
  const token = state.accessToken;
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleExamRegistration = async () => {
    if (!token) {
      Alert.alert('Not signed in', 'Login first to register for exams.');
      return;
    }
    try {
      const response = await registerForExams(token);
      Alert.alert(response.allowed ? 'Registered' : 'Not allowed', response.detail);
    } catch (error: any) {
      const message = error?.message ?? 'Unable to register for exams right now.';
      Alert.alert('Registration blocked', message);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if(selectedDate) {
        setFilterDate(selectedDate);
    }
  };

  const filteredAssignments = useMemo(() => {
    if (!filterDate) {
      return assignmentsData;
    }
    return assignmentsData.filter(
      (item) => item.due.getFullYear() === filterDate.getFullYear() &&
               item.due.getMonth() === filterDate.getMonth() &&
               item.due.getDate() === filterDate.getDate()
    );
  }, [filterDate]);

  const getDueDateText = (dueDate: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Assignments</Text>
      <Text style={styles.subtitle}>
        Use the microphone button to dictate answers or ask for help.
      </Text>

      <View style={styles.filterContainer}>
        <VoiceButton 
            label={filterDate ? `Filtering for: ${filterDate.toLocaleDateString()}` : "Filter by Due Date"}
            onPress={() => setShowDatePicker(true)} 
        />
        {filterDate && <VoiceButton label="Clear Filter" onPress={() => setFilterDate(null)} />}
      </View>

      {showDatePicker && (
        <DateTimePicker
            testID="dateTimePicker"
            value={filterDate || new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
        />
      )}

      {filteredAssignments.length > 0 ? filteredAssignments.map((item) => (
        <View key={item.title} style={styles.card}>
          <Ionicons name='document-text' size={28} color={palette.accent} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{getDueDateText(item.due)}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
            <VoiceButton label='Open assignment' onPress={() => {}} />
          </View>
        </View>
      )) : (
        <Text style={styles.noResults}>No assignments due on this date.</Text>
      )}

      <VoiceButton
        label='Register for exams'
        onPress={handleExamRegistration}
        accessibilityHint='Checks fee clearance before registration'
      />
      <VoiceButton
        label='Ask for assignment help'
        onPress={() => {}}
        accessibilityHint='Send help message'
      />
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
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
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
    color: palette.warning,
  },
  cardDescription: {
    ...typography.body,
    color: palette.textSecondary,
  },
  noResults: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
});