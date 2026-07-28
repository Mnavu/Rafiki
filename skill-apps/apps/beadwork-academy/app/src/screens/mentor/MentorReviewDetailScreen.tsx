import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigActionButton, spacing, typography, useActivePalette } from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchSubmissionDetail, MilestoneSubmission, reviewSubmission } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "MentorReviewDetail">;

export function MentorReviewDetailScreen({ route, navigation }: Props) {
  const { submissionId } = route.params;
  const palette = useActivePalette();
  const { accessToken } = useAuth();
  const [submission, setSubmission] = useState<MilestoneSubmission | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [awardPoints, setAwardPoints] = useState("20");
  const [badgeCode, setBadgeCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setSubmission(await fetchSubmissionDetail(accessToken, submissionId));
  }, [accessToken, submissionId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const handleReview = async (status: "approved" | "needs_changes") => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await reviewSubmission(accessToken, submissionId, {
        status,
        feedbackText,
        awardPoints: status === "approved" ? Number(awardPoints) || 0 : 0,
        badgeCode: status === "approved" ? badgeCode : "",
      });
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  if (!submission) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={[typography.body, { padding: spacing.lg, color: palette.textMuted }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingL, { color: palette.text }]}>{submission.milestone_title}</Text>
        <Text style={[typography.body, { color: palette.textMuted }]}>From {submission.learner_username}</Text>

        {submission.photo ? <Image source={{ uri: submission.photo }} style={styles.media} /> : null}
        {submission.learner_note_text ? (
          <Text style={[typography.body, { color: palette.text, marginTop: spacing.md }]}>
            "{submission.learner_note_text}"
          </Text>
        ) : null}

        <Text style={[typography.headingM, { color: palette.text, marginTop: spacing.xl }]}>Your feedback</Text>
        <TextInput
          value={feedbackText}
          onChangeText={setFeedbackText}
          placeholder="Say something encouraging..."
          multiline
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />

        <Text style={[typography.body, { color: palette.text, marginTop: spacing.sm }]}>
          Stars to award (if approved)
        </Text>
        <TextInput
          value={awardPoints}
          onChangeText={setAwardPoints}
          keyboardType="number-pad"
          style={[styles.smallInput, { borderColor: palette.border, color: palette.text }]}
        />

        <Text style={[typography.body, { color: palette.text, marginTop: spacing.sm }]}>
          Badge code (optional, e.g. FIRST_MAT)
        </Text>
        <TextInput
          value={badgeCode}
          onChangeText={setBadgeCode}
          autoCapitalize="characters"
          style={[styles.smallInput, { borderColor: palette.border, color: palette.text }]}
        />

        <BigActionButton
          label="Approve"
          icon="✅"
          disabled={submitting}
          onPress={() => handleReview("approved")}
        />
        <BigActionButton
          label="Ask for changes"
          icon="🔄"
          size="compact"
          disabled={submitting}
          onPress={() => handleReview("needs_changes")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  media: { width: "100%", height: 220, borderRadius: 12, marginTop: spacing.md },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
  },
  smallInput: { borderWidth: 2, borderRadius: 12, padding: spacing.sm, width: 160 },
});
