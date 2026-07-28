import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useActivePalette } from "../hooks/useActivePalette";
import { radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

export type ChecklistRowProps = {
  caption: string;
  completed: boolean;
  practiceCount?: number;
  onToggle: () => void;
};

export function ChecklistRow({ caption, completed, practiceCount, onToggle }: ChecklistRowProps) {
  const palette = useActivePalette();

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={caption}
      onPress={onToggle}
      style={[
        styles.row,
        { backgroundColor: completed ? palette.success : palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.box, { borderColor: completed ? palette.surface : palette.textMuted }]}>
        {completed ? <Text style={{ color: palette.surface, fontWeight: "700" }}>✓</Text> : null}
      </View>
      <Text style={[typography.body, { color: completed ? palette.surface : palette.text, flex: 1 }]}>
        {caption}
      </Text>
      {practiceCount && practiceCount > 1 ? (
        <Text style={[typography.helper, { color: completed ? palette.surface : palette.textMuted }]}>
          x{practiceCount}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
});
