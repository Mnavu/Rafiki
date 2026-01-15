import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const groups = [
  { name: 'All Lecturers', members: 12 },
  { name: 'Guardians - ICT201', members: 24 },
];

export const HodCommunicationsScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Broadcast Communications</Text>
    <Text style={styles.subtitle}>Send announcements to lecturers or guardian cohorts.</Text>
    {groups.map((group) => (
      <View key={group.name} style={styles.card}>
        <Ionicons name="mail" size={28} color={palette.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{group.name}</Text>
          <Text style={styles.cardMeta}>{group.members} recipients</Text>
          <VoiceButton label="Compose message" onPress={() => {}} />
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
