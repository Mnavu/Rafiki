import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const subjects = [
  { name: 'Mathematics', score: 85, attendance: '92% present' },
  { name: 'Science', score: 72, attendance: '88% present' },
  { name: 'Creative Arts', score: 94, attendance: '100% present' },
];

export const GuardianProgressScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Progress Overview</Text>
    <Text style={styles.subtitle}>
      Tap a subject to hear voice summaries or share updates with teachers.
    </Text>
    {subjects.map((subject) => (
      <View key={subject.name} style={styles.card}>
        <Ionicons name="ribbon" size={28} color={palette.success} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{subject.name}</Text>
          <Text style={styles.cardMeta}>
            Score {subject.score}% - {subject.attendance}
          </Text>
          <VoiceButton label="See details" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Speak summary" onPress={() => {}} />
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
