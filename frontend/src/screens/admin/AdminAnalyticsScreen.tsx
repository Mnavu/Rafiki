import React from 'react';
import { ScrollView, View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { fetchAdminAnalytics } from '@services/api';

export const AdminAnalyticsScreen: React.FC = () => {
  const { state } = useAuth();
  const { data, isLoading } = useQuery(
    ['adminAnalytics'],
    () => fetchAdminAnalytics(state.accessToken || ''),
    {
      enabled: !!state.accessToken,
    }
  );

  const analytics = [
    { label: 'Weekly logins', value: data?.weekly_logins ?? 'N/A', icon: 'log-in' },
    { label: 'Chatbot questions', value: data?.chatbot_questions ?? 'N/A', icon: 'chatbubble' },
    { label: 'Alerts sent', value: data?.alerts_sent ?? 'N/A', icon: 'notifications' },
  ];

  if (isLoading) {
    return <ActivityIndicator style={styles.loadingContainer} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.subtitle}>Monitor usage stats and voice assistant interactions.</Text>
      {analytics.map((item) => (
        <View key={item.label} style={styles.card}>
          <Ionicons name={item.icon as any} size={28} color={palette.primary} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.label}</Text>
            <Text style={styles.cardMeta}>{item.value}</Text>
          </View>
        </View>
      ))}
      <VoiceButton label="Export analytics" onPress={() => {}} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, backgroundColor: palette.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
