import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

// TODO: This screen needs a proper backend API to fetch a list of all students with their finance status.
// The current data is mocked.
const ledgers = [
  { student: 'Student Name', balance: 'KES 4,000', status: 'Partial', tag: palette.warning },
  { student: 'Another Student', balance: 'KES 0', status: 'Paid', tag: palette.success },
];

export const FinanceStudentsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Student Ledgers</Text>
    <Text style={styles.subtitle}>
      Search, view receipts, and record new payments with a tap-friendly keypad.
    </Text>
    {ledgers.map((item) => (
      <View key={item.student} style={styles.card}>
        <Ionicons name="person-circle" size={32} color={item.tag} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.student}</Text>
          <Text style={styles.cardMeta}>
            {item.balance} � {item.status}
          </Text>
          <VoiceButton label="Open ledger" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Record payment" onPress={() => {}} />
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
