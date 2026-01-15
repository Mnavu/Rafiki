import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const reports = [
  { title: 'Semester Summary', detail: 'PDF with grade distributions and attendance.' },
  { title: 'Student Flags', detail: 'CSV listing students requiring support.' },
];

export const RecordsReportsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Reports</Text>
    <Text style={styles.subtitle}>Generate documents for senate or accreditation reviews.</Text>
    {reports.map((report) => (
      <View key={report.title} style={styles.card}>
        <Ionicons name="stats-chart" size={28} color={palette.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{report.title}</Text>
          <Text style={styles.cardMeta}>{report.detail}</Text>
          <VoiceButton label="Download" onPress={() => {}} />
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
  cardMeta: { ...typography.body, color: palette.textSecondary },
});
