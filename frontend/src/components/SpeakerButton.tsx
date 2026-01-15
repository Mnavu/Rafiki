import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { palette, radius } from '@theme/index';

interface SpeakerButtonProps {
  onPress?: () => void;
  isActive?: boolean;
  icon?: React.ReactNode;
}

export const SpeakerButton: React.FC<SpeakerButtonProps> = ({ onPress, isActive, icon }) => {
  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.active]}
      accessibilityRole="button"
      accessibilityLabel="Read this screen aloud"
      onPress={onPress}
    >
      {icon}
    </TouchableOpacity>
  );
};

const size = 56;

const styles = StyleSheet.create({
  container: {
    width: size,
    height: size,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  active: {
    backgroundColor: palette.primary,
  },
});
