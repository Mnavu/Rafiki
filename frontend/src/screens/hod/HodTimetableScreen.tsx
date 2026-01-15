import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const conflicts = [{ course: 'ICT201', conflict: 'Overlaps with ENG110 on Monday 10 AM' }];

export const HodTimetableScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Department Timetable</Text>
    <Text style={styles.subtitle}>Review proposed schedules and highlight clashes instantly.</Text>
    {conflicts.map((item) => (
      <View key={item.course} style={styles.card}>
        <Ionicons name="warning" size={28} color={palette.danger} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.course}</Text>
          <Text style={styles.cardMeta}>{item.conflict}</Text>
          <VoiceButton label="Resolve" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Approve timetable" onPress={() => {}} />
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
  cardMeta: { ...typography.body, color: palette.textSecondary },
});
