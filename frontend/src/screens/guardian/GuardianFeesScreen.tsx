import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const fees = [
  {
    item: 'Tuition Term 1',
    due: 'KES 12,000',
    status: 'Balance KES 4,000',
    color: palette.warning,
  },
  { item: 'Therapy Sessions', due: 'KES 6,500', status: 'Paid', color: palette.success },
];

export const GuardianFeesScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Fees & Payments</Text>
    <Text style={styles.subtitle}>
      Easily see balances, track payment plans, and set reminders.
    </Text>
    {fees.map((fee) => (
      <View key={fee.item} style={styles.card}>
        <Ionicons name="cash" size={28} color={fee.color} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{fee.item}</Text>
          <Text style={styles.cardMeta}>
            {fee.due} - {fee.status}
          </Text>
          <VoiceButton label="Pay or request plan" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Download fee statement" onPress={() => {}} />
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
