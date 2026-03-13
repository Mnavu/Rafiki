import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { palette, radius, spacing } from '@theme/index';

type ChatbotBubbleProps = {
  onPress: () => void;
  style?: ViewStyle;
};

export const ChatbotBubble: React.FC<ChatbotBubbleProps> = ({ onPress, style }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel="Open student help chatbot"
    accessibilityHint="Opens the chatbot for quick course and class help."
    activeOpacity={0.8}
    onPress={onPress}
    style={[styles.bubble, style]}
  >
    <MaterialCommunityIcons name="robot-outline" size={28} color={palette.surface} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 84,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});

