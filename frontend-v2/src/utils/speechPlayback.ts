import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export type PreferredSpeechVoice = {
  id?: string;
  language?: string;
  hasUsableVoice?: boolean;
  diagnosticMessage?: string;
  voiceCount?: number;
};

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

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
    await pause(140);
  } catch {
    // Keep speech usable even when audio mode cannot be configured on some devices.
  }
};

export const loadPreferredSpeechVoice = async (): Promise<PreferredSpeechVoice> => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!voices?.length) {
      return {
        hasUsableVoice: false,
        voiceCount: 0,
        diagnosticMessage:
          'No device speech voice was found. Turn on Android text-to-speech and install an English voice to hear read-aloud.',
      };
    }
    const englishVoice =
      voices.find((voice) => voice.language?.toLowerCase().startsWith('en-ke')) ??
      voices.find((voice) => voice.language?.toLowerCase().startsWith('en')) ??
      voices[0];
    return {
      id: englishVoice?.identifier,
      language: englishVoice?.language ?? 'en-US',
      hasUsableVoice: true,
      voiceCount: voices.length,
    };
  } catch {
    return {
      diagnosticMessage:
        'Could not inspect speech voices on this device. The app will try the default system voice.',
    };
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
  await pause(100);

  const failureMessage =
    preferredVoice?.hasUsableVoice === false
      ? 'No usable device speech voice was found. Turn on Android text-to-speech, download an English voice, and raise media volume.'
      : 'Voice playback failed on this device. Check media volume and Android text-to-speech settings.';

  const attempts: Array<{
    label: string;
    options: { language?: string; voice?: string };
  }> = [];

  attempts.push({
    label: 'Speaking aloud...',
    options: {},
  });

  if (preferredVoice?.language) {
    attempts.push({
      label: 'Retrying with device language...',
      options: {
        language: preferredVoice.language,
      },
    });
  }

  if (preferredVoice?.id || preferredVoice?.language) {
    attempts.push({
      label: 'Retrying with selected voice...',
      options: {
        ...(preferredVoice?.language ? { language: preferredVoice.language } : {}),
        ...(preferredVoice?.id ? { voice: preferredVoice.id } : {}),
      },
    });
  }

  const startSpeech = (attemptIndex: number) => {
    const attempt = attempts[attemptIndex];
    if (!attempt) {
      onStatusChange?.('Voice failed. Check device speech settings.');
      onError?.(failureMessage);
      return;
    }

    onStatusChange?.(attempt.label);
    Speech.speak(text, {
      pitch: 1,
      rate: speechRate && speechRate > 0 ? speechRate : 0.82,
      volume: 1,
      ...attempt.options,
      onDone: () => onStatusChange?.(null),
      onStopped: () => onStatusChange?.(null),
      onError: () => {
        void (async () => {
          await stopSpeechPlayback();
          await pause(80);
          startSpeech(attemptIndex + 1);
        })();
      },
    });
  };

  startSpeech(0);
};
