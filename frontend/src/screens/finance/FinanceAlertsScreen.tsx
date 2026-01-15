import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const alerts = [
  { title: 'Bulk reminder', detail: 'Send SMS to overdue accounts', icon: 'notifications' },
  { title: 'Payment plan', detail: "Follow up with Brian's parent", icon: 'call' },
];

export const FinanceAlertsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Alerts & Reminders</Text>
    <Text style={styles.subtitle}>Schedule automatic nudges or one-touch bulk outreach.</Text>
    {alerts.map((alert) => (
      <View key={alert.title} style={styles.card}>
        <Ionicons name={alert.icon as any} size={28} color={palette.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{alert.title}</Text>
          <Text style={styles.cardMeta}>{alert.detail}</Text>
          <VoiceButton label="Schedule" onPress={() => {}} />
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
    ...typography.helper,
    color: palette.textSecondary,
  },
});
