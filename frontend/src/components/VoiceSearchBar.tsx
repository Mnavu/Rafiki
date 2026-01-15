import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';

type VoiceSearchBarProps = {
  placeholder?: string;
  onPress?: () => void;
  onVoicePress?: () => void;
};

export const VoiceSearchBar: React.FC<VoiceSearchBarProps> = ({
  placeholder = 'Search or ask EduAssist',
  onPress,
  onVoicePress,
}) => {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.container} activeOpacity={0.9} onPress={onPress}>
        <View style={styles.left}>
          <Ionicons name="search" size={18} color={palette.textSecondary} />
          <Text style={styles.placeholder}>{placeholder}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.micButton} onPress={onVoicePress}>
            <Ionicons name="mic" size={18} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={styles.brandPill}>
            <Text style={styles.brandText}>EA</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.disabled,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  placeholder: {
    ...typography.body,
    color: palette.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    ...typography.helper,
    color: palette.surface,
  },
});
