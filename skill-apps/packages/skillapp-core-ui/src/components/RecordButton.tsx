import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAutoStopRecording, type AutoStopRecordingOptions } from "../hooks/useAutoStopRecording";
import { useActivePalette } from "../hooks/useActivePalette";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { BigActionButton } from "./BigActionButton";

export type RecordButtonProps = AutoStopRecordingOptions & {
  idleLabel?: string;
  onRecordingComplete: (uri: string) => void;
};

/**
 * Hands-free narrated capture: tap once to start, the recording auto-stops
 * itself once the learner goes quiet (see useAutoStopRecording). No second
 * tap required to stop, matching Nanu's voice-search/voice-question pattern.
 * Fires onRecordingComplete whether the stop was manual (button re-tapped)
 * or automatic (silence detected) - both paths land on the same `uri` state
 * from the hook, watched here via effect rather than only on the manual path.
 */
export function RecordButton({ idleLabel = "Record", onRecordingComplete, ...options }: RecordButtonProps) {
  const palette = useActivePalette();
  const { status, error, uri, start, stop } = useAutoStopRecording(options);
  const deliveredUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "stopped" && uri && deliveredUriRef.current !== uri) {
      deliveredUriRef.current = uri;
      onRecordingComplete(uri);
    }
  }, [status, uri, onRecordingComplete]);

  const handlePress = () => {
    if (status === "recording") {
      void stop();
      return;
    }
    void start();
  };

  const label = status === "recording" ? "Listening... tap to stop" : idleLabel;

  return (
    <View>
      <BigActionButton
        label={label}
        icon={status === "recording" ? "🔴" : "🎙️"}
        isActive={status === "recording"}
        onPress={handlePress}
      />
      {error ? (
        <Text style={[typography.helper, { color: palette.danger, marginTop: spacing.xs }]}>{error}</Text>
      ) : null}
    </View>
  );
}
