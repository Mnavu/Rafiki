import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const systems = [
  { name: 'SIS Integration', status: 'Connected', icon: 'link' },
  { name: 'Notifications', status: 'Celery worker running', icon: 'notifications' },
];

export const AdminSystemsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Systems</Text>
    <Text style={styles.subtitle}>Manage integrations, Celery schedules, and notifications.</Text>
    {systems.map((system) => (
      <View key={system.name} style={styles.card}>
        <Ionicons name={system.icon as any} size={28} color={palette.accent} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{system.name}</Text>
          <Text style={styles.cardMeta}>{system.status}</Text>
          <VoiceButton label="Configure" onPress={() => {}} />
        </View>
      </View>
    ))}
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
