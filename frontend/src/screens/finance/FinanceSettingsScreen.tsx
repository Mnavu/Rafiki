import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const settings = [
  {
    title: 'Fee Items',
    description: 'Add or edit tuition, therapy, transport items.',
    icon: 'list',
  },
  { title: 'Waivers', description: 'Manage bursaries and special discounts.', icon: 'pricetag' },
  {
    title: 'Payment Plans',
    description: 'Configure instalment schedules with reminders.',
    icon: 'calendar',
  },
];

export const FinanceSettingsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Finance Settings</Text>
    <Text style={styles.subtitle}>
      Control fee structures, waivers, and instalments in one place.
    </Text>
    {settings.map((item) => (
      <View key={item.title} style={styles.card}>
        <Ionicons name={item.icon as any} size={28} color={palette.accent} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>{item.description}</Text>
          <VoiceButton label="Open settings" onPress={() => {}} />
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
