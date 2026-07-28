import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  BigActionButton,
  ChecklistRow,
  spacing,
  speakWithFallback,
  StepCard,
  typography,
  useAccessibilityPrefs,
  useActivePalette,
} from "@skillapp-core/ui";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import {
  completeChecklistStep,
  fetchLessonDetail,
  fetchLessonStepStatus,
  LessonDetail,
  StepStatusMap,
} from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "LessonPlayer">;

export function LessonPlayerScreen({ route, navigation }: Props) {
  const { lessonCode } = route.params;
  const palette = useActivePalette();
  const { accessToken } = useAuth();
  const { speechRate } = useAccessibilityPrefs();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatusMap>({});
  const [videoDismissed, setVideoDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [detail, status] = await Promise.all([
      fetchLessonDetail(accessToken, lessonCode),
      fetchLessonStepStatus(accessToken, lessonCode),
    ]);
    setLesson(detail);
    setStepStatus(status);
  }, [accessToken, lessonCode]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const toggleStep = async (stepId: number) => {
    if (!accessToken) return;
    const result = await completeChecklistStep(accessToken, stepId);
    setStepStatus((prev) => ({
      ...prev,
      [String(stepId)]: { completed: true, practice_count: result.practice_count },
    }));
  };

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={[typography.body, { color: palette.textMuted, padding: spacing.lg }]}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  const showVideo = lesson.is_new_technique && !!lesson.intro_video_url && !videoDismissed;
  const milestone = lesson.milestones[0];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingL, { color: palette.text }]}>{lesson.title}</Text>
        {lesson.instructions_text ? (
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.xs }]}>
            {lesson.instructions_text}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.sm }}>
          <BigActionButton
            label="Read instructions aloud"
            icon="🔊"
            size="compact"
            onPress={() => speakWithFallback(lesson.instructions_text || lesson.title, { rate: speechRate })}
          />
        </View>

        {showVideo && (
          <View style={{ marginTop: spacing.lg }}>
            <LessonVideo url={lesson.intro_video_url} />
            <View style={{ marginTop: spacing.sm }}>
              <BigActionButton
                label="I've seen this - skip to practice"
                icon="⏭️"
                size="compact"
                onPress={() => setVideoDismissed(true)}
              />
            </View>
          </View>
        )}

        <View style={{ marginTop: spacing.lg }}>
          {lesson.steps.map((step) => {
            const status = stepStatus[String(step.id)];
            return (
              <StepCard
                key={step.id}
                order={step.order}
                caption={step.caption}
                photoUrl={step.photo_url}
                onReadAloud={() => speakWithFallback(step.caption, { rate: speechRate })}
              >
                {step.is_checklist_item && (
                  <ChecklistRow
                    caption="I did this step"
                    completed={!!status?.completed}
                    practiceCount={status?.practice_count}
                    onToggle={() => toggleStep(step.id)}
                  />
                )}
              </StepCard>
            );
          })}
        </View>

        {milestone && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.headingM, { color: palette.text }]}>🎉 {milestone.title}</Text>
            <Text style={[typography.body, { color: palette.textMuted, marginVertical: spacing.sm }]}>
              {milestone.instructions_for_learner}
            </Text>
            <BigActionButton
              label="Show your finished work"
              icon="📸"
              onPress={() =>
                navigation.navigate("MilestoneCapture", {
                  milestoneId: milestone.id,
                  milestoneTitle: milestone.title,
                  requiresVideo: milestone.requires_video,
                })
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LessonVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls allowsFullscreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg },
  video: { width: "100%", height: 220, borderRadius: 12, marginTop: spacing.sm },
});
