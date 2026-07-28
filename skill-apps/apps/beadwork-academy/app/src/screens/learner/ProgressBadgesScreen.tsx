import { spacing, typography, useActivePalette } from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchMyProgress, fetchMyRewards, ProgressSummary, RewardsSummary } from "../../services/api";

export function ProgressBadgesScreen() {
  const palette = useActivePalette();
  const { accessToken } = useAuth();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [p, r] = await Promise.all([fetchMyProgress(accessToken), fetchMyRewards(accessToken)]);
    setProgress(p);
    setRewards(r);
  }, [accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.starCard, { backgroundColor: palette.primary }]}>
          <Text style={[typography.headingXL, { color: palette.surface }]}>{rewards?.stars ?? 0} ⭐</Text>
          <Text style={[typography.body, { color: palette.surface }]}>stars earned</Text>
        </View>

        <Text style={[typography.headingM, { color: palette.text, marginTop: spacing.xl }]}>My badges</Text>
        {rewards && rewards.history.filter((h) => h.badge).length === 0 ? (
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.sm }]}>
            Finish a milestone project to earn your first badge!
          </Text>
        ) : (
          rewards?.history
            .filter((h) => h.badge)
            .map((h) => (
              <View key={h.id} style={[styles.badgeRow, { borderColor: palette.border }]}>
                <Text style={{ fontSize: 28 }}>🏅</Text>
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.body, { color: palette.text }]}>{h.badge_title}</Text>
                  <Text style={[typography.helper, { color: palette.textMuted }]}>{h.reason}</Text>
                </View>
                <Text style={[typography.body, { color: palette.primary }]}>+{h.points}</Text>
              </View>
            ))
        )}

        <Text style={[typography.headingM, { color: palette.text, marginTop: spacing.xl }]}>My modules</Text>
        {progress?.lessons.map((l) => (
          <View key={l.id} style={[styles.lessonRow, { borderColor: palette.border }]}>
            <Text style={[typography.body, { color: palette.text }]}>{l.lesson_code}</Text>
            <Text style={[typography.helper, { color: palette.textMuted }]}>
              {l.steps_completed}/{l.steps_total} steps · {l.status}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg },
  starCard: { borderRadius: 16, padding: spacing.lg, alignItems: "center" },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  lessonRow: { borderBottomWidth: 1, paddingVertical: spacing.sm },
});
