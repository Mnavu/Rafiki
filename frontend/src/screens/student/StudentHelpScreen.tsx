import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const faqs = [
  {
    question: 'How do I submit homework?',
    answer: 'Open the assignment, tap record or upload, then press send.',
  },
  {
    question: 'How do I join an online lesson?',
    answer: 'Go to My Timetable and tap Join lesson.',
  },
];

export const StudentHelpScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Help & Support</Text>
    <Text style={styles.subtitle}>
      Ask a question or tap a topic below. Everything can be read aloud.
    </Text>
    <View style={styles.card}>
      <Ionicons name="chatbubbles" size={32} color={palette.accent} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>Talk to advisor</Text>
        <Text style={styles.cardDescription}>Start a live chat with your support teacher.</Text>
        <VoiceButton label="Start chat" onPress={() => {}} />
      </View>
    </View>
    <Text style={styles.subtitle}>Popular questions</Text>
    {faqs.map((faq) => (
      <View key={faq.question} style={styles.faq}>
        <Text style={styles.faqQuestion}>{faq.question}</Text>
        <Text style={styles.faqAnswer}>{faq.answer}</Text>
      </View>
    ))}
    <VoiceButton label="Speak to EduAssist" onPress={() => {}} accessibilityHint="Open assistant" />
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
  cardDescription: {
    ...typography.body,
    color: palette.textSecondary,
  },
  faq: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  faqQuestion: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  faqAnswer: {
    ...typography.body,
    color: palette.textSecondary,
  },
});
