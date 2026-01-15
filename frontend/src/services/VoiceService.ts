import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

type TTSOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  onDone?: () => void;
  onStart?: () => void;
  onError?: (error: Error) => void;
};

class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;
  private speechQueue: Promise<void> = Promise.resolve();

  constructor() {
    Audio.requestPermissionsAsync();
  }

  // Text-to-Speech (TTS)
  public async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!text) {return;}

    this.speechQueue = this.speechQueue.then(async () => {
      return new Promise<void>((resolve, reject) => {
        try {
          Speech.speak(text, {
            language: options?.language || 'en-US',
            pitch: options?.pitch || 1.0,
            rate: options?.rate || 1.0,
            onDone: () => {
              options?.onDone?.();
              resolve();
            },
            onStart: options?.onStart,
            onError: (error) => {
              options?.onError?.(new Error(error.message));
              reject(new Error(error.message));
            },
          });
        } catch (error) {
          options?.onError?.(error as Error);
          reject(error);
        }
      });
    });

    return this.speechQueue;
  }

  public stopSpeaking(): void {
    Speech.stop();
  }

  // Speech-to-Text (STT) - Recording
  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,

        // This setting might be problematic on some Android devices.
        // It should allow playback while recording.
        // For production, more robust testing across devices is needed.
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await recording.startAsync();
      this.recording = recording;
      this.isRecording = true;
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      throw err;
    }
  }

  public async stopRecording(): Promise<string | null> {
    if (!this.isRecording || !this.recording) {
      console.warn('Not recording.');
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;
      console.log('Recording stopped, URI:', uri);

      // Reset audio mode to allow normal playback behavior
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
      });

      return uri;
    } catch (err) {
      console.error('Failed to stop recording', err);
      throw err;
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  // Placeholder for actual STT processing (will involve backend)
  public async transcribeAudio(audioUri: string): Promise<string> {
    console.log('Sending audio for transcription:', audioUri);
    // In a real application, this would send the audio URI (or the audio file itself)
    // to your backend API, which would then interface with a STT service (e.g., Google Cloud Speech-to-Text).
    // For now, return a mock transcription.
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
    return `(Mock transcription of ${audioUri})`;
  }
}

export const voiceService = new VoiceService();
