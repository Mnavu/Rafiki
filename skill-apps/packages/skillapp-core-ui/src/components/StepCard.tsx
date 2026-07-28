import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useActivePalette } from "../hooks/useActivePalette";
import { radius, spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { BigActionButton } from "./BigActionButton";

export type StepCardProps = {
  order: number;
  caption: string;
  photoUrl?: string;
  onReadAloud?: () => void;
  children?: React.ReactNode;
};

export function StepCard({ order, caption, photoUrl, onReadAloud, children }: StepCardProps) {
  const palette = useActivePalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: palette.primary }]}>
          <Text style={[typography.helper, { color: palette.surface, fontWeight: "700" }]}>{order}</Text>
        </View>
        {onReadAloud ? (
          <BigActionButton label="Read aloud" icon="🔊" size="compact" iconOnly onPress={onReadAloud} />
        ) : null}
      </View>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" accessibilityLabel={caption} />
      ) : null}
      <Text style={[typography.bodyLarge, { color: palette.text, marginTop: spacing.sm }]}>{caption}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
});
