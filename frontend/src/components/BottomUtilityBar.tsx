import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { palette, spacing, typography } from '@theme/index';

interface UtilityItem {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  isActive?: boolean;
}

interface BottomUtilityBarProps {
  items: UtilityItem[];
}

export const BottomUtilityBar: React.FC<BottomUtilityBarProps> = ({ items }) => {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.isActive }}
          style={[styles.item, item.isActive && styles.activeItem]}
          onPress={item.onPress}
        >
          {item.icon}
          <Text style={styles.label}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 10,
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeItem: {
    borderBottomWidth: 3,
    borderBottomColor: palette.primary,
  },
  label: {
    ...typography.helper,
    color: palette.textPrimary,
  },
});
