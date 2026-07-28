import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BigActionButton, RecordButton, spacing, typography, useActivePalette } from "@skillapp-core/ui";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { submitMilestone } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "MilestoneCapture">;

export function MilestoneCaptureScreen({ route, navigation }: Props) {
  const { milestoneId, milestoneTitle, requiresVideo } = route.params;
  const palette = useActivePalette();
  const { accessToken } = useAuth();

  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [videoUri, setVideoUri] = useState<string | undefined>();
  const [audioUri, setAudioUri] = useState<string | undefined>();
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takeVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: "videos", videoMaxDuration: 30 });
    if (!result.canceled && result.assets[0]) setVideoUri(result.assets[0].uri);
  };

  const canSubmit = !!photoUri || !!videoUri;

  const handleSubmit = async () => {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMilestone(accessToken, milestoneId, { noteText, photoUri, videoUri, audioUri });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={styles.content}>
          <Text style={[typography.headingL, { color: palette.text }]}>Sent! 🎉</Text>
          <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.sm }]}>
            Your mentor will look at your work and let you know what they think.
          </Text>
          <View style={{ marginTop: spacing.lg }}>
            <BigActionButton label="Back to home" icon="🏠" onPress={() => navigation.navigate("LearnerHome")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingL, { color: palette.text }]}>{milestoneTitle}</Text>
        <Text style={[typography.body, { color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg }]}>
          Take a photo{requiresVideo ? " and a short video" : " (or a video)"} of your work.
        </Text>

        <View style={styles.row}>
          <BigActionButton label={photoUri ? "Retake photo" : "Take a photo"} icon="📷" onPress={takePhoto} />
          <BigActionButton label={videoUri ? "Retake video" : "Take a video"} icon="🎥" onPress={takeVideo} />
        </View>

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}

        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.headingM, { color: palette.text, marginBottom: spacing.sm }]}>
            Want to say something about it?
          </Text>
          <RecordButton idleLabel="Record a voice note" onRecordingComplete={setAudioUri} />
          {audioUri ? (
            <Text style={[typography.helper, { color: palette.success, marginTop: spacing.xs }]}>
              Voice note recorded ✓
            </Text>
          ) : null}
        </View>

        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Or type a note (optional)"
          multiline
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />

        {error ? (
          <Text style={[typography.helper, { color: palette.danger, marginBottom: spacing.md }]}>{error}</Text>
        ) : null}

        <BigActionButton
          label={submitting ? "Sending..." : "Send to my mentor"}
          icon="✅"
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg },
  row: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  preview: { width: "100%", height: 200, borderRadius: 12, marginTop: spacing.md },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    minHeight: 80,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    textAlignVertical: "top",
  },
});
