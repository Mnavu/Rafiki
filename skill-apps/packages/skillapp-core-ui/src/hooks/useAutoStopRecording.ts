import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";

/**
 * Metering-based auto-stop voice/video-narration recording, extracted into a
 * shared hook. Mirrors the state machine embedded directly in Nanu's
 * frontend-v2/src/screens/student/StudentHomeScreen.tsx:1085-1128 (voice
 * search) and StudentChatbotScreen.tsx (voice question) - here it's reusable
 * across both a milestone-narration capture screen and any future voice-note
 * screen, instead of being copy-pasted per screen as it is in Nanu today.
 *
 * Records until the learner stops talking (metering drops below
 * `silenceThresholdDb` for `silenceWindowMs` after speech was detected), with
 * a `maxDurationMs` hard cap and a `noSpeechTimeoutMs` fallback if the
 * learner never starts talking at all (e.g. device mic issue).
 */
export type AutoStopRecordingOptions = {
  silenceThresholdDb?: number;
  maxDurationMs?: number;
  silenceWindowMs?: number;
  noSpeechTimeoutMs?: number;
};

export type AutoStopRecordingStatus = "idle" | "recording" | "stopped" | "error";

const DEFAULTS: Required<AutoStopRecordingOptions> = {
  silenceThresholdDb: -50,
  maxDurationMs: 30000,
  silenceWindowMs: 1500,
  noSpeechTimeoutMs: 6000,
};

export function useAutoStopRecording(options?: AutoStopRecordingOptions) {
  const config = { ...DEFAULTS, ...options };
  const [status, setStatus] = useState<AutoStopRecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const speechDetectedRef = useRef(false);
  const lastSpeechAtRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const stoppingRef = useRef(false);

  const stop = useCallback(async (): Promise<{ uri: string } | null> => {
    const recording = recordingRef.current;
    if (!recording || stoppingRef.current) return null;
    stoppingRef.current = true;
    try {
      await recording.stopAndUnloadAsync();
      const recordedUri = recording.getURI();
      setUri(recordedUri);
      setStatus("stopped");
      recordingRef.current = null;
      return recordedUri ? { uri: recordedUri } : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      return null;
    } finally {
      stoppingRef.current = false;
    }
  }, []);

  const handleStatusUpdate = useCallback(
    (recordingStatus: Audio.RecordingStatus) => {
      if (!recordingStatus.isRecording) return;
      const now = Date.now();
      const elapsed = now - startedAtRef.current;

      if (elapsed >= config.maxDurationMs) {
        void stop();
        return;
      }

      const metering = recordingStatus.metering;
      if (typeof metering !== "number") {
        // Device doesn't support metering - fall back to a fixed duration.
        if (elapsed >= config.noSpeechTimeoutMs) void stop();
        return;
      }

      if (metering > config.silenceThresholdDb) {
        speechDetectedRef.current = true;
        lastSpeechAtRef.current = now;
        return;
      }

      if (speechDetectedRef.current) {
        if (now - lastSpeechAtRef.current >= config.silenceWindowMs) {
          void stop();
        }
      } else if (elapsed >= config.noSpeechTimeoutMs) {
        void stop();
      }
    },
    [config.maxDurationMs, config.noSpeechTimeoutMs, config.silenceThresholdDb, config.silenceWindowMs, stop]
  );

  const start = useCallback(async () => {
    setError(null);
    setUri(null);
    speechDetectedRef.current = false;
    lastSpeechAtRef.current = 0;
    startedAtRef.current = Date.now();

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        handleStatusUpdate,
        200
      );
      recordingRef.current = recording;
      setStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [handleStatusUpdate]);

  return { status, error, uri, start, stop };
}
