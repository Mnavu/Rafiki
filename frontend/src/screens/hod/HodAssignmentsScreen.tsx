import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const courses = [
  { course: 'ICT201', lecturer: 'Mr. Kamau', status: 'Confirmed' },
  { course: 'ICT305', lecturer: 'Ms. Wanjiru', status: 'Needs replacement' },
];

export const HodAssignmentsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Course Assignments</Text>
    <Text style={styles.subtitle}>
      Drag-and-drop in production; here, preview current allocations.
    </Text>
    {courses.map((item) => (
      <View key={item.course} style={styles.card}>
        <Ionicons name="swap-horizontal" size={28} color={palette.accent} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.course}</Text>
          <Text style={styles.cardMeta}>
            {item.lecturer} � {item.status}
          </Text>
          <VoiceButton label="Reassign" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Speak summary" onPress={() => {}} />
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, backgroundColor: palette.background },
  title: { ...typography.headingXL, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary },
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
  cardBody: { flex: 1, gap: spacing.sm },
  cardTitle: { ...typography.headingM, color: palette.textPrimary },
  cardMeta: { ...typography.helper, color: palette.textSecondary },
});
