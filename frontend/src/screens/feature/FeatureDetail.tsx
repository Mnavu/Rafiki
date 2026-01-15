import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { palette, spacing, typography } from '@theme/index';
import { FeatureDescriptor } from '@data/featureCatalog';
import { VoiceButton } from '@components/index';
import type { Role } from '@app-types/roles';

interface FeatureDetailProps {
  feature: FeatureDescriptor;
  role: Role;
  onSpeak?: () => void;
}

export const FeatureDetail: React.FC<FeatureDetailProps> = ({ feature, role, onSpeak }) => (
  <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}>
      <Text style={styles.role}>{role.toUpperCase()}</Text>
      <Text style={styles.title}>{feature.title}</Text>
      <Text style={styles.description}>{feature.description}</Text>
      {feature.apiHint ? <Text style={styles.hint}>{feature.apiHint}</Text> : null}
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What you can do</Text>
      <Text style={styles.body}>
        This screen will host the detailed workflow for the selected tile, including live data,
        voice shortcuts, and accessibility controls. Use this prototype to explore layouts and
        interactions before wiring real data.
      </Text>
    </View>
    {feature.callToAction ? (
      <VoiceButton
        label={feature.callToAction}
        onPress={() => {}}
        accessibilityHint={`Open ${feature.title}`}
      />
    ) : null}
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Tip: use the voice button to preview narration and ensure minimum 48dp targets for all
        controls.
      </Text>
    </View>
    {onSpeak ? (
      <VoiceButton label="Read aloud" onPress={onSpeak} accessibilityHint="Play an audio summary" />
    ) : null}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: palette.background,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  role: {
    ...typography.helper,
    color: palette.textSecondary,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.headingXL,
    color: palette.textPrimary,
  },
  description: {
    ...typography.body,
    color: palette.textSecondary,
  },
  hint: {
    ...typography.helper,
    color: palette.accent,
  },
  section: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: 24,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  footerText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
});
