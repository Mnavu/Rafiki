import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { spacing, typography, useActivePalette } from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchLearnerProgressForMentor, ProgressSummary } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "MentorLearnerProgress">;

export function MentorLearnerProgressScreen({ route }: Props) {
  const { learnerId, learnerUsername } = route.params;
  const palette = useActivePalette();
  const { accessToken } = useAuth();
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setProgress(await fetchLearnerProgressForMentor(accessToken, learnerId));
  }, [accessToken, learnerId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingL, { color: palette.text }]}>{learnerUsername}'s progress</Text>
        {progress && (
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.xs }]}>
            {progress.completed_lessons} of {progress.total_lessons} lessons completed
          </Text>
        )}
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
  lessonRow: { borderBottomWidth: 1, paddingVertical: spacing.sm },
});
