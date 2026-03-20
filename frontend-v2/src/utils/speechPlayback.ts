import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export type PreferredSpeechVoice = {
  id?: string;
  language?: string;
};

const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
  staysActiveInBackground: false,
};

type SpeakWithFallbackArgs = {
  text: string;
  speechRate?: number;
  preferredVoice?: PreferredSpeechVoice;
  onStatusChange?: (status: string | null) => void;
  onError?: (message: string) => void;
};

export const prepareSpeechPlayback = async () => {
  try {
    await Audio.setIsEnabledAsync(true);
  } catch {
    // Some platforms do not expose an enable toggle.
  }

  try {
    await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);
  } catch {
    // Keep speech usable even when audio mode cannot be configured on some devices.
  }
};

export const loadPreferredSpeechVoice = async (): Promise<PreferredSpeechVoice> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices?.length) {
      return {};
    }
    const englishVoice =
      voices.find((voice) => voice.language?.toLowerCase().startsWith('en-ke')) ??
      voices.find((voice) => voice.language?.toLowerCase().startsWith('en')) ??
      voices[0];
    return {
      id: englishVoice?.identifier,
      language: englishVoice?.language ?? 'en-US',
    };
  } catch {
    return {};
  }
};

export const stopSpeechPlayback = async () => {
  try {
    await Speech.stop();
  } catch {
    // Ignore stop errors during cleanup.
  }
};

export const speakWithFallback = async ({
  text,
  speechRate,
  preferredVoice,
  onStatusChange,
  onError,
}: SpeakWithFallbackArgs) => {
  if (!text.trim()) {
    return;
  }

  await prepareSpeechPlayback();
  await stopSpeechPlayback();
  onStatusChange?.('Speaking...');

  const attempts: Array<{
    label: string;
    options: { language?: string; voice?: string };
  }> = [];

  if (preferredVoice?.id || preferredVoice?.language) {
    attempts.push({
      label: 'Speaking...',
      options: {
        ...(preferredVoice?.language ? { language: preferredVoice.language } : {}),
        ...(preferredVoice?.id ? { voice: preferredVoice.id } : {}),
      },
    });
  }

  if (preferredVoice?.language) {
    attempts.push({
      label: 'Retrying with device language...',
      options: { language: preferredVoice.language },
    });
  }

  attempts.push({
    label: 'Retrying with device voice...',
    options: {},
  });

  const startSpeech = (attemptIndex: number) => {
    const attempt = attempts[attemptIndex];
    if (!attempt) {
      onStatusChange?.('Voice failed. Check media volume and device speech settings.');
      onError?.(
        'Voice playback failed on this device. Check media volume and Android text-to-speech settings.',
      );
      return;
    }

    onStatusChange?.(attempt.label);
    Speech.speak(text, {
      pitch: 1,
      rate: speechRate && speechRate > 0 ? speechRate : 0.9,
      ...attempt.options,
      onDone: () => onStatusChange?.(null),
      onStopped: () => onStatusChange?.(null),
      onError: () => {
        startSpeech(attemptIndex + 1);
      },
    });
  };

  startSpeech(0);
};
