import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  BigActionButton,
  DashboardTile,
  spacing,
  speakWithFallback,
  typography,
  useAccessibilityPrefs,
  useActivePalette,
} from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchMyProgress, fetchMyRewards, ProgressSummary, RewardsSummary } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "LearnerHome">;

export function LearnerHomeScreen({ navigation }: Props) {
  const palette = useActivePalette();
  const { user, accessToken, logout } = useAuth();
  const { speechRate } = useAccessibilityPrefs();
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

  const greeting = `Hi ${user?.username ?? "there"}! Ready to practice beadwork today?`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingXL, { color: palette.text }]}>{greeting}</Text>

        <View style={styles.actionsRow}>
          <BigActionButton
            label="Read this page aloud"
            icon="🔊"
            size="compact"
            onPress={() => speakWithFallback(greeting, { rate: speechRate })}
          />
          <BigActionButton label="Settings" icon="⚙️" size="compact" onPress={() => navigation.navigate("ProfileSettings")} />
        </View>

        {progress && (
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.md }]}>
            {progress.completed_lessons} of {progress.total_lessons} lessons completed
          </Text>
        )}
        {rewards && (
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.xs }]}>
            {rewards.stars} stars earned so far
          </Text>
        )}

        <View style={styles.tileGrid}>
          <DashboardTile
            title="Continue practicing"
            subtitle="See your modules and lessons"
            icon="🧵"
            onPress={() => navigation.navigate("ModuleList")}
          />
          <DashboardTile
            title="My badges"
            subtitle="See stars and badges you've earned"
            icon="🏅"
            onPress={() => navigation.navigate("ProgressBadges")}
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <BigActionButton label="Log out" icon="🚪" size="compact" onPress={() => logout()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  tileGrid: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, flexWrap: "wrap" },
});
