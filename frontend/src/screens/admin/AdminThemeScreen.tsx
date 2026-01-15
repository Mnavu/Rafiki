import React from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

const options = [
  { label: 'Brand colors', description: 'Switch to high-contrast or light theme.' },
  { label: 'Voice pack', description: 'Choose English, Kiswahili, or blended voices.' },
];

export const AdminThemeScreen: React.FC = () => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Theme & Accessibility</Text>
    <Text style={styles.subtitle}>Control branding, contrast, and voice settings globally.</Text>
    {options.map((option) => (
      <View key={option.label} style={styles.card}>
        <Ionicons name="color-palette" size={28} color={palette.secondary} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{option.label}</Text>
          <Text style={styles.cardMeta}>{option.description}</Text>
          <VoiceButton label="Adjust" onPress={() => {}} />
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
