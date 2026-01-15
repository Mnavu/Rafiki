import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const announcements = [
  { title: 'Sports Day', detail: 'Friday 10 AM at the main field. Wear school colors.' },
  { title: 'Guardian Coffee', detail: 'Join us Wednesday 8 AM for a support meetup.' },
];

export const GuardianAnnouncementsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Announcements</Text>
    <Text style={styles.subtitle}>All notices are transcribed and can be played aloud.</Text>
    {announcements.map((item) => (
      <View key={item.title} style={styles.card}>
        <Ionicons name="megaphone" size={28} color={palette.accent} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>{item.detail}</Text>
          <VoiceButton label="Play announcement" onPress={() => {}} />
        </View>
      </View>
    ))}
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
    ...typography.body,
    color: palette.textSecondary,
  },
});
