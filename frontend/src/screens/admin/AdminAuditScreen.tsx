import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const logs = [
  { action: 'password_change', detail: 'parent1 reset via self-service', time: '2025-10-07 09:10' },
  { action: 'api_request', detail: 'student1 viewed timetable', time: '2025-10-07 08:55' },
];

export const AdminAuditScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Audit & Policies</Text>
    <Text style={styles.subtitle}>Review user activity, password changes, and system events.</Text>
    {logs.map((log) => (
      <View key={log.time + log.action} style={styles.card}>
        <Ionicons name="shield-checkmark" size={28} color={palette.primary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{log.action}</Text>
          <Text style={styles.cardMeta}>{log.detail}</Text>
          <Text style={styles.cardMeta}>{log.time}</Text>
        </View>
      </View>
    ))}
    <VoiceButton label="Export log" onPress={() => {}} />
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
  cardBody: { flex: 1, gap: spacing.xs },
  cardTitle: { ...typography.headingM, color: palette.textPrimary },
  cardMeta: { ...typography.helper, color: palette.textSecondary },
});
