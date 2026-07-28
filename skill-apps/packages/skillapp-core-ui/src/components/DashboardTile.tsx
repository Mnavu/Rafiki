import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useActivePalette } from "../hooks/useActivePalette";
import { radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export type DashboardTileProps = {
  title: string;
  subtitle?: string;
  icon?: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function DashboardTile({ title, subtitle, icon, disabled, onPress }: DashboardTileProps) {
  const palette = useActivePalette();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: disabled ? palette.disabled : palette.border,
          borderStyle: disabled ? "dashed" : "solid",
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: palette.background }]}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
        </View>
      ) : null}
      <Text style={[typography.headingM, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.helper, { color: palette.textMuted, marginTop: spacing.xs }]}>{subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    minWidth: 150,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
});
