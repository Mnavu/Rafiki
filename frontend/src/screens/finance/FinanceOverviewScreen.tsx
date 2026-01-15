import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const kpis = [
  { label: 'Total Due', value: 'KES 2.4M', icon: 'alert-circle', color: palette.danger },
  { label: 'Collected', value: 'KES 1.8M', icon: 'cash', color: palette.success },
  { label: 'Overdue', value: 'KES 600K', icon: 'time', color: palette.warning },
];

export const FinanceOverviewScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Fees Overview</Text>
    <Text style={styles.subtitle}>Key metrics with spoken summaries and quick export.</Text>
    <View style={styles.kpiRow}>
      {kpis.map((kpi) => (
        <View key={kpi.label} style={[styles.kpiCard, { borderColor: kpi.color }]}>
          <Ionicons name={kpi.icon as any} size={24} color={kpi.color} />
          <Text style={styles.kpiLabel}>{kpi.label}</Text>
          <Text style={styles.kpiValue}>{kpi.value}</Text>
        </View>
      ))}
    </View>
    <VoiceButton label="Speak overview" onPress={() => {}} />
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
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 2,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  kpiLabel: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  kpiValue: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
});
