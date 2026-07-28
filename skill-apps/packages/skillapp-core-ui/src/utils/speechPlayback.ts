import * as Speech from "expo-speech";
import { Audio } from "expo-av";

/**
 * TTS fallback cascade, ported from Nanu's frontend-v2/src/utils/speechPlayback.ts:
 * try the default voice, then the device language, then an explicit
 * preferred voice id, retrying on error; report a user-facing diagnostic
 * if no usable voice exists at all rather than failing silently.
 */

let cachedPreferredVoiceId: string | null | undefined;

export async function loadPreferredSpeechVoice(): Promise<{ voiceId: string | null; hasUsableVoice: boolean }> {
  if (cachedPreferredVoiceId !== undefined) {
    return { voiceId: cachedPreferredVoiceId, hasUsableVoice: cachedPreferredVoiceId !== null };
  }
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const preferred =
      voices.find((v) => v.language?.toLowerCase().startsWith("en-ke")) ??
      voices.find((v) => v.language?.toLowerCase().startsWith("en")) ??
      voices[0];
    cachedPreferredVoiceId = preferred?.identifier ?? null;
  } catch {
    cachedPreferredVoiceId = null;
  }
  return { voiceId: cachedPreferredVoiceId, hasUsableVoice: cachedPreferredVoiceId !== null };
}

export type SpeakStatus = (message: string) => void;

export async function speakWithFallback(
  text: string,
  options?: { rate?: number; onStatus?: SpeakStatus }
): Promise<void> {
  if (!text.trim()) return;

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  } catch {
    // Non-fatal: playback can still proceed without forcing audio mode.
  }
  // Small pause avoids a clipped first syllable on some devices.
  await new Promise((resolve) => setTimeout(resolve, 120));

  const { voiceId, hasUsableVoice } = await loadPreferredSpeechVoice();

  const attempts: (Speech.SpeechOptions | undefined)[] = [
    { rate: options?.rate },
    { rate: options?.rate, language: undefined },
  ];
  if (hasUsableVoice && voiceId) {
    attempts.push({ rate: options?.rate, voice: voiceId });
  }

  let attemptIndex = 0;

  return new Promise((resolve) => {
    const tryNext = () => {
      if (attemptIndex >= attempts.length) {
        options?.onStatus?.("No text-to-speech voice is available on this device.");
        resolve();
        return;
      }
      const attemptOptions = attempts[attemptIndex];
      attemptIndex += 1;
      if (attemptIndex > 1) {
        options?.onStatus?.("Retrying with a different voice...");
      }
      Speech.speak(text, {
        ...attemptOptions,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => tryNext(),
      });
    };
    tryNext();
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
