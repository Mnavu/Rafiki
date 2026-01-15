import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const uploads = [
  { file: 'ICT201_midterm.csv', status: 'Ready to validate', icon: 'cloud-upload' },
  { file: 'Therapy_reports.xlsx', status: 'Published', icon: 'checkmark-circle' },
];

export const RecordsExamsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Exams & Grades</Text>
    <Text style={styles.subtitle}>Import CSVs, validate, and publish in a few taps.</Text>
    {uploads.map((item) => (
      <View key={item.file} style={styles.card}>
        <Ionicons name={item.icon as any} size={28} color={palette.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.file}</Text>
          <Text style={styles.cardMeta}>{item.status}</Text>
          <VoiceButton label="Open" onPress={() => {}} />
        </View>
      </View>
    ))}
    <VoiceButton label="Download template" onPress={() => {}} />
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
