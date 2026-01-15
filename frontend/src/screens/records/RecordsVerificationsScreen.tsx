import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const requests = [
  { employer: 'Inclusive Tech Ltd', student: 'Student Name', status: 'Pending' },
  { employer: 'Ministry of Education', student: 'Another Student', status: 'Completed' },
];

// TODO: This screen needs a proper backend API and data model.
// The current data is mocked. The spec does not mention "verifications".
// This might be a feature to be designed or a leftover from a previous version.


export const RecordsVerificationsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Verifications</Text>
    <Text style={styles.subtitle}>Respond to employer requests with one-tap confirmations.</Text>
    {requests.map((req) => (
      <View key={req.employer + req.student} style={styles.card}>
        <Ionicons name="briefcase" size={28} color={palette.accent} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{req.employer}</Text>
          <Text style={styles.cardMeta}>
            {req.student} � {req.status}
          </Text>
          <VoiceButton label="Review request" onPress={() => {}} />
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
