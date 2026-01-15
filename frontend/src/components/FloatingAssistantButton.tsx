import React from 'react';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing, typography } from '@theme/index';

interface FloatingAssistantButtonProps {
  label?: string;
  onPress?: () => void;
}

export const FloatingAssistantButton: React.FC<FloatingAssistantButtonProps> = ({
  label = 'Nanu',
  onPress,
}) => (
  <TouchableOpacity
    style={styles.container}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Open Nanu assistant"
  >
    <Text style={styles.text}>{label}</Text>
  </TouchableOpacity>
);

const size = 64;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl + spacing.md,
    right: spacing.md,
    width: size,
    height: size,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 12,
  },
  text: {
    ...typography.body,
    color: palette.surface,
  },
});
