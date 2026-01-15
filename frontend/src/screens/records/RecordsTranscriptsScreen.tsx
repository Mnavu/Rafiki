import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

// TODO: This screen needs a proper backend API to fetch students and their transcript status.
// The current data is mocked.
const transcripts = [
  { student: 'Student Name', status: 'Ready', format: 'PDF' },
  { student: 'Another Student', status: 'Awaiting finance clearance', format: 'PDF' },
];

export const RecordsTranscriptsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Transcripts</Text>
    <Text style={styles.subtitle}>Generate watermarked PDFs and share securely.</Text>
    {transcripts.map((item) => (
      <View key={item.student} style={styles.card}>
        <Ionicons name="document-text" size={28} color={palette.secondary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.student}</Text>
          <Text style={styles.cardMeta}>{item.status}</Text>
          <VoiceButton label="Generate" onPress={() => {}} />
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
