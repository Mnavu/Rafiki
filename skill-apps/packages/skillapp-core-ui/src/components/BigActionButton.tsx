import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useActivePalette } from "../hooks/useActivePalette";
import { radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

/**
 * One generic, large-tap-target accessible action button used everywhere -
 * navigation actions, voice triggers, menu toggles - rather than a separate
 * button component per concept. Mirrors Nanu's VoiceButton pattern
 * (frontend-v2/src/components/VoiceButton.tsx), themed via the *real*
 * high-contrast palette swap instead of a cosmetic label change.
 */
export type BigActionButtonProps = {
  label: string;
  icon?: string;
  isActive?: boolean;
  size?: "default" | "compact";
  iconOnly?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
};

export function BigActionButton({
  label,
  icon,
  isActive,
  size = "default",
  iconOnly,
  disabled,
  accessibilityHint,
  onPress,
}: BigActionButtonProps) {
  const palette = useActivePalette();
  const isCompact = size === "compact";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected: !!isActive }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: isActive ? palette.primary : palette.surface,
          borderColor: palette.primary,
          paddingVertical: isCompact ? spacing.sm : spacing.md,
          paddingHorizontal: isCompact ? spacing.md : spacing.lg,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        {!iconOnly && (
          <Text
            style={[
              typography.bodyLarge,
              { color: isActive ? palette.surface : palette.text, marginLeft: icon ? spacing.sm : 0 },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 20,
  },
});
