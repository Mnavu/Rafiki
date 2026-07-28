import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { LearnerHomeScreen } from "../screens/learner/LearnerHomeScreen";
import { ModuleListScreen } from "../screens/learner/ModuleListScreen";
import { LessonPlayerScreen } from "../screens/learner/LessonPlayerScreen";
import { MilestoneCaptureScreen } from "../screens/learner/MilestoneCaptureScreen";
import { ProgressBadgesScreen } from "../screens/learner/ProgressBadgesScreen";
import { MentorReviewInboxScreen } from "../screens/mentor/MentorReviewInboxScreen";
import { MentorReviewDetailScreen } from "../screens/mentor/MentorReviewDetailScreen";
import { MentorLearnerProgressScreen } from "../screens/mentor/MentorLearnerProgressScreen";
import { ProfileSettingsScreen } from "../screens/ProfileSettingsScreen";

export type RootStackParamList = {
  Login: undefined;
  LearnerHome: undefined;
  ModuleList: undefined;
  LessonPlayer: { lessonCode: string; moduleCode: string };
  MilestoneCapture: { milestoneId: number; milestoneTitle: string; requiresVideo: boolean };
  ProgressBadges: undefined;
  MentorReviewInbox: undefined;
  MentorReviewDetail: { submissionId: number };
  MentorLearnerProgress: { learnerId: number; learnerUsername: string };
  ProfileSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : user.role === "learner" ? (
          <>
            <Stack.Screen name="LearnerHome" component={LearnerHomeScreen} options={{ title: "Beadwork Academy" }} />
            <Stack.Screen name="ModuleList" component={ModuleListScreen} options={{ title: "Modules" }} />
            <Stack.Screen name="LessonPlayer" component={LessonPlayerScreen} options={{ title: "Lesson" }} />
            <Stack.Screen
              name="MilestoneCapture"
              component={MilestoneCaptureScreen}
              options={{ title: "Show your work" }}
            />
            <Stack.Screen name="ProgressBadges" component={ProgressBadgesScreen} options={{ title: "My progress" }} />
            <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: "Settings" }} />
          </>
        ) : (
          <>
            <Stack.Screen
              name="MentorReviewInbox"
              component={MentorReviewInboxScreen}
              options={{ title: "Review inbox" }}
            />
            <Stack.Screen
              name="MentorReviewDetail"
              component={MentorReviewDetailScreen}
              options={{ title: "Review submission" }}
            />
            <Stack.Screen
              name="MentorLearnerProgress"
              component={MentorLearnerProgressScreen}
              options={{ title: "Learner progress" }}
            />
            <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{ title: "Settings" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
