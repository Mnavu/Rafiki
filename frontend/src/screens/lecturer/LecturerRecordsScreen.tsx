import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

// TODO: This screen needs a proper backend API to fetch submissions for the lecturer's units.
// The current data is mocked.
const grades = [
  { student: 'Student Name', course: 'ICT201', score: '85%', status: 'Great progress' },
  { student: 'Another Student', course: 'ICT201', score: '68%', status: 'Needs follow-up' },
  { student: 'Yet Another', course: 'ICT305', score: '92%', status: 'Ready for advanced work' },
];

export const LecturerRecordsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Grades & Attendance</Text>
    <Text style={styles.subtitle}>Enter marks with numeric steppers or import CSV templates.</Text>
    {grades.map((item) => (
      <View key={item.student + item.course} style={styles.card}>
        <Ionicons name="create" size={28} color={palette.success} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>
            {item.student} � {item.course}
          </Text>
          <Text style={styles.cardMeta}>
            {item.score} � {item.status}
          </Text>
          <VoiceButton label="Update record" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Import spreadsheet" onPress={() => {}} />
  </ScrollView>
);

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
});
