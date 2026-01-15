import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const timetable = [
  { time: '08:00', activity: 'Math lesson', location: 'Room B204' },
  { time: '10:00', activity: 'Science Lab', location: 'Lab 1' },
  { time: '14:00', activity: 'Therapy session', location: 'Wellness Center' },
];

export const GuardianTimetableScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Child&apos;s Timetable</Text>
    <Text style={styles.subtitle}>Follow the day and set spoken reminders 15 minutes ahead.</Text>
    {timetable.map((slot) => (
      <View key={slot.activity} style={styles.card}>
        <Ionicons name="time" size={28} color={palette.secondary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{slot.activity}</Text>
          <Text style={styles.cardMeta}>
            {slot.time} - {slot.location}
          </Text>
          <VoiceButton label="Set reminder" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Speak timetable" onPress={() => {}} />
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
