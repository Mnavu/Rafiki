import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { askChatbot, transcribeAudio } from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { roleLabels } from '@app-types/roles';
import { normalizeSpeechText } from '../../utils/speechNormalization';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

type ChatHistoryItem = {
  id: string;
  question: string;
  answer: string;
  visualCue: string | null;
};

type ChatTurn = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  visualCue?: string | null;
};

const QUICK_PROMPTS = [
  'When is my next class?',
  'Do I have an upcoming class call?',
  'What school activities are coming up?',
  'Help me revise my course topic.',
];

const VOICE_QUESTION_SPEECH_THRESHOLD_DB = -45;
const VOICE_QUESTION_SILENCE_MS = 1200;
const VOICE_QUESTION_MIN_DURATION_MS = 800;
const VOICE_QUESTION_MAX_DURATION_MS = 15000;
const VOICE_QUESTION_NO_SPEECH_TIMEOUT_MS = 5500;
const VOICE_QUESTION_NO_METERING_FALLBACK_MS = 5000;

export const StudentChatbotScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [forceNewConversation, setForceNewConversation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const voiceSpeechDetectedRef = useRef(false);
  const voiceLastSpeechMsRef = useRef<number | null>(null);
  const voiceAutoStoppingRef = useRef(false);

  const studentName = useMemo(
    () => state.user?.display_name?.trim() || state.user?.username || roleLabels.student,
    [state.user],
  );

  const conversationTurns = useMemo<ChatTurn[]>(() => {
    const turns: ChatTurn[] = [];
    [...history].reverse().forEach((item) => {
      turns.push({
        id: `${item.id}-q`,
        role: 'user',
        text: item.question,
      });
      turns.push({
        id: `${item.id}-a`,
        role: 'bot',
        text: item.answer,
        visualCue: item.visualCue,
      });
    });
    return turns;
  }, [history]);

  const pushQuestionToChatbot = useCallback(
    async (prompt: string) => {
      if (!state.accessToken) {
        return;
      }
      const response = await askChatbot(
        state.accessToken,
        prompt,
        conversationId ?? undefined,
        forceNewConversation,
      );
      if (typeof response.conversation_id === 'number') {
        setConversationId(response.conversation_id);
      }
      if (forceNewConversation) {
        setForceNewConversation(false);
      }
      const item: ChatHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        question: prompt,
        answer: response.text,
        visualCue: response.visual_cue ?? null,
      };
      setHistory((current) => [item, ...current].slice(0, 12));
    },
    [conversationId, forceNewConversation, state.accessToken],
  );

  const askQuestion = useCallback(async (rawQuestion?: string) => {
    if (!state.accessToken || submitting) {
      return;
    }
    const prompt = (rawQuestion ?? question).trim();
    if (!prompt) {
      setError('Please type or select a question for the chatbot.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await pushQuestionToChatbot(prompt);
      setQuestion('');
    } catch (askError) {
      if (askError instanceof Error) {
        setError(askError.message);
      } else {
        setError('Unable to reach the chatbot right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [pushQuestionToChatbot, question, state.accessToken, submitting]);

  const stopVoiceQuestion = useCallback(
    async (reason: 'manual' | 'silence' | 'max' | 'fallback' = 'manual') => {
      const activeRecording = voiceRecordingRef.current;
      if (!activeRecording || voiceAutoStoppingRef.current) {
        return;
      }
      voiceAutoStoppingRef.current = true;
      setVoiceBusy(true);
      setError(null);
      try {
        await activeRecording.stopAndUnloadAsync();
        const uri = activeRecording.getURI();
        voiceRecordingRef.current = null;
        setRecordingActive(false);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        if (!uri || !state.accessToken) {
          throw new Error('Recorded voice file not found.');
        }
        const transcript = await transcribeAudio(state.accessToken, { audioUri: uri });
        const normalized = normalizeSpeechText(transcript.text || '').trim();
        if (!normalized) {
          setError(
            reason === 'silence'
              ? 'I did not hear a full question. Try again and speak a bit louder.'
              : 'No clear speech detected. Please try again.',
          );
          return;
        }
        setQuestion(normalized);
        await askQuestion(normalized);
      } catch (voiceError) {
        if (voiceError instanceof Error) {
          setError(voiceError.message);
        } else {
          setError('Unable to process voice question.');
        }
      } finally {
        voiceSpeechDetectedRef.current = false;
        voiceLastSpeechMsRef.current = null;
        voiceAutoStoppingRef.current = false;
        setVoiceBusy(false);
      }
    },
    [askQuestion, state.accessToken],
  );

  const startVoiceQuestion = useCallback(async () => {
    if (recordingActive || submitting || voiceBusy) {
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required for voice input.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      voiceSpeechDetectedRef.current = false;
      voiceLastSpeechMsRef.current = null;
      voiceAutoStoppingRef.current = false;

      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          if (!status?.isRecording || voiceAutoStoppingRef.current) {
            return;
          }
          const now = Date.now();
          const duration = status.durationMillis ?? 0;
          const metering = typeof status.metering === 'number' ? status.metering : null;

          if (duration >= VOICE_QUESTION_MAX_DURATION_MS) {
            void stopVoiceQuestion('max');
            return;
          }

          if (metering === null) {
            if (duration >= VOICE_QUESTION_NO_METERING_FALLBACK_MS) {
              void stopVoiceQuestion('fallback');
            }
            return;
          }

          if (metering > VOICE_QUESTION_SPEECH_THRESHOLD_DB) {
            voiceSpeechDetectedRef.current = true;
            voiceLastSpeechMsRef.current = now;
            return;
          }

          if (
            !voiceSpeechDetectedRef.current &&
            duration >= VOICE_QUESTION_NO_SPEECH_TIMEOUT_MS
          ) {
            void stopVoiceQuestion('silence');
            return;
          }

          if (
            voiceSpeechDetectedRef.current &&
            voiceLastSpeechMsRef.current &&
            duration >= VOICE_QUESTION_MIN_DURATION_MS &&
            now - voiceLastSpeechMsRef.current >= VOICE_QUESTION_SILENCE_MS
          ) {
            void stopVoiceQuestion('silence');
          }
        },
        200,
      );
      voiceRecordingRef.current = recording;
      setRecordingActive(true);
      setError(null);
    } catch (voiceError) {
      if (voiceError instanceof Error) {
        setError(voiceError.message);
      } else {
        setError('Unable to start voice question.');
      }
    }
  }, [recordingActive, stopVoiceQuestion, submitting, voiceBusy]);

  const toggleVoiceQuestion = useCallback(async () => {
    if (recordingActive) {
      await stopVoiceQuestion('manual');
    } else {
      await startVoiceQuestion();
    }
  }, [recordingActive, startVoiceQuestion, stopVoiceQuestion]);

  const cancelVoiceQuestion = useCallback(async () => {
    const activeRecording = voiceRecordingRef.current;
    if (!activeRecording) {
      return;
    }
    voiceAutoStoppingRef.current = true;
    try {
      await activeRecording.stopAndUnloadAsync();
    } catch {
      // Ignore cancellation cleanup errors.
    } finally {
      voiceRecordingRef.current = null;
      voiceSpeechDetectedRef.current = false;
      voiceLastSpeechMsRef.current = null;
      setRecordingActive(false);
      setVoiceBusy(false);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {
        // Keep UI usable even when audio reset fails.
      });
      voiceAutoStoppingRef.current = false;
    }
  }, []);

  const speakAnswer = async (text: string) => {
    if (!text.trim()) {
      return;
    }
    try {
      await Speech.stop();
      Speech.speak(text, {
        rate: state.user?.speech_rate && state.user.speech_rate > 0 ? state.user.speech_rate : 0.9,
      });
    } catch {
      setError('Voice playback failed on this device.');
    }
  };

  useEffect(
    () => () => {
      Speech.stop();
      const activeRecording = voiceRecordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => {
          // Ignore cleanup failures.
        });
        voiceRecordingRef.current = null;
      }
    },
    [],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GreetingHeader
          name={studentName}
          greeting="Student help chatbot"
          rightAccessory={<RoleBadge role="student" />}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ask a question</Text>
          <View style={styles.composeCard}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Example: When is my next class call?"
              placeholderTextColor={palette.textSecondary}
              multiline
              style={styles.input}
            />
            <View style={styles.composeActions}>
              <VoiceButton
                label={submitting ? 'Asking question' : 'Ask chatbot'}
                icon={
                  <MaterialCommunityIcons
                    name={submitting ? 'progress-clock' : 'send'}
                    size={20}
                    color={palette.surface}
                  />
                }
                iconOnly
                size="compact"
                style={styles.iconButton}
                onPress={() => askQuestion()}
                accessibilityHint="Send your typed question to chatbot."
              />
              <VoiceButton
                label="Clear"
                icon={<MaterialCommunityIcons name="close-circle-outline" size={20} color={palette.surface} />}
                iconOnly
                size="compact"
                style={styles.iconButton}
                onPress={() => {
                  setQuestion('');
                  setError(null);
                }}
                accessibilityHint="Clear typed question."
              />
              <VoiceButton
                label={recordingActive ? 'Listening. Tap to stop' : 'Voice question'}
                icon={
                  <MaterialCommunityIcons
                    name={recordingActive ? 'microphone-off' : 'microphone'}
                    size={20}
                    color={palette.surface}
                  />
                }
                iconOnly
                size="compact"
                style={styles.iconButton}
                onPress={toggleVoiceQuestion}
                isActive={recordingActive || voiceBusy}
                accessibilityHint="Start voice question. App auto-detects when you finish speaking."
              />
            </View>
            <Text style={styles.iconLegend}>Ask | Clear | Voice</Text>
            <Text style={styles.helper}>
              {recordingActive
                ? 'Listening now. Pause and the question will be captured automatically.'
                : voiceBusy
                  ? 'Processing your voice question...'
                  : 'Use the mic icon and speak naturally. The app stops automatically when you finish.'}
            </Text>
            <Text style={styles.helper}>
              {conversationId
                ? 'Conversation memory is active for your current chat.'
                : 'Conversation memory will start as soon as you ask your first question.'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversation</Text>
          <View style={styles.chatWindow}>
            {conversationTurns.length ? (
              conversationTurns.map((turn) => (
                <View
                  key={turn.id}
                  style={[
                    styles.chatBubble,
                    turn.role === 'user' ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text style={styles.chatSender}>
                    {turn.role === 'user' ? 'You' : 'Chatbot'}
                  </Text>
                  <Text style={styles.chatText}>{turn.text}</Text>
                  {turn.role === 'bot' && turn.visualCue ? (
                    <Text style={styles.cue}>Cue: {turn.visualCue}</Text>
                  ) : null}
                  {turn.role === 'bot' ? (
                    <View style={styles.chatActions}>
                      <VoiceButton
                        label="Speak answer"
                        icon={<MaterialCommunityIcons name="volume-high" size={20} color={palette.surface} />}
                        iconOnly
                        size="compact"
                        style={styles.iconButton}
                        onPress={() => speakAnswer(turn.text)}
                      />
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <DashboardTile
                title="No conversation yet"
                subtitle="Ask your first question above to begin chatting with the assistant."
                disabled
              />
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Chatbot error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick prompts</Text>
          {QUICK_PROMPTS.map((prompt, index) => (
            <DashboardTile
              key={`quick-prompt-${prompt}-${index}`}
              title={prompt}
              subtitle="Tap to ask this question."
              onPress={() => askQuestion(prompt)}
              disabled={submitting}
            />
          ))}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          {
            label: 'New chat',
            onPress: () => {
              setForceNewConversation(true);
              setConversationId(null);
              setHistory([]);
              setQuestion('');
              setError(null);
            },
          },
          { label: 'Back', onPress: () => navigation.goBack() },
          {
            label: 'Stop voice',
            onPress: async () => {
              await Speech.stop();
              await cancelVoiceQuestion();
            },
          },
          { label: 'Log out', onPress: logout },
        ]}
        compact
        simpleMode={state.user?.prefers_simple_language !== false}
        highContrast={state.user?.prefers_high_contrast === true}
        onToggleSimpleMode={() =>
          updatePreferences({
            prefers_simple_language: !(state.user?.prefers_simple_language !== false),
          })
        }
        onToggleHighContrast={() =>
          updatePreferences({
            prefers_high_contrast: !(state.user?.prefers_high_contrast === true),
          })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  composeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  input: {
    ...typography.body,
    minHeight: 96,
    borderWidth: 1,
    borderColor: palette.disabled,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.textPrimary,
    backgroundColor: palette.background,
    textAlignVertical: 'top',
  },
  composeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 48,
    height: 48,
  },
  iconLegend: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  errorCard: {
    backgroundColor: '#FEE4E2',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.headingM,
    color: palette.danger,
  },
  errorBody: {
    ...typography.helper,
    color: '#912018',
  },
  chatWindow: {
    gap: spacing.sm,
  },
  chatBubble: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderColor: '#BFDBFE',
    backgroundColor: '#E8F1FF',
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderColor: '#D1D5DB',
    backgroundColor: palette.surface,
  },
  chatSender: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  chatText: {
    ...typography.body,
    color: palette.textPrimary,
  },
  chatActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  question: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  answer: {
    ...typography.body,
    color: palette.textPrimary,
  },
  cue: {
    ...typography.helper,
    color: palette.primary,
  },
});
