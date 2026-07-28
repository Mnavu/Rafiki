import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigActionButton, DashboardTile, spacing, typography, useActivePalette } from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchMentorInbox, fetchMentorLearners, LinkedLearner, MilestoneSubmission } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "MentorReviewInbox">;

export function MentorReviewInboxScreen({ navigation }: Props) {
  const palette = useActivePalette();
  const { user, accessToken, logout } = useAuth();
  const [inbox, setInbox] = useState<MilestoneSubmission[]>([]);
  const [learners, setLearners] = useState<LinkedLearner[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const [pending, linked] = await Promise.all([fetchMentorInbox(accessToken), fetchMentorLearners(accessToken)]);
    setInbox(pending);
    setLearners(linked);
  }, [accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingXL, { color: palette.text }]}>Hi {user?.username}!</Text>
        <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.xs }]}>
          {inbox.length === 0 ? "No submissions waiting for review." : `${inbox.length} submission(s) waiting for you.`}
        </Text>

        {inbox.map((submission) => (
          <DashboardTile
            key={submission.id}
            title={submission.milestone_title}
            subtitle={`From ${submission.learner_username}`}
            icon="📥"
            onPress={() => navigation.navigate("MentorReviewDetail", { submissionId: submission.id })}
          />
        ))}

        <Text style={[typography.headingM, { color: palette.text, marginTop: spacing.xl }]}>My learners</Text>
        {learners.map((l) => (
          <DashboardTile
            key={l.learner_id}
            title={l.learner_username}
            subtitle="View progress"
            icon="🧒"
            onPress={() =>
              navigation.navigate("MentorLearnerProgress", { learnerId: l.learner_id, learnerUsername: l.learner_username })
            }
          />
        ))}

        <BigActionButton label="Settings" icon="⚙️" size="compact" onPress={() => navigation.navigate("ProfileSettings")} />
        <BigActionButton label="Log out" icon="🚪" size="compact" onPress={() => logout()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
});
