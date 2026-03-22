import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { askChatbot, submitChatbotFeedback, transcribeAudio } from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { roleLabels } from '@app-types/roles';
import { normalizeSpeechText } from '../../utils/speechNormalization';
import {
  loadPreferredSpeechVoice,
  prepareSpeechPlayback,
  speakWithFallback,
  stopSpeechPlayback,
  type PreferredSpeechVoice,
} from '../../utils/speechPlayback';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

type ChatHistoryItem = {
  id: string;
  question: string;
  answer: string;
  visualCue: string | null;
  turnId?: number | null;
  navigationTarget?: string | null;
  feedbackRating?: 'helpful' | 'not_helpful' | null;
};

type ChatTurn = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  visualCue?: string | null;
  turnId?: number | null;
  navigationTarget?: string | null;
  feedbackRating?: 'helpful' | 'not_helpful' | null;
};

const QUICK_PROMPTS = [
  'When is my next class?',
  'Do I have an upcoming class call?',
  'Where do I find study materials?',
  'How do I use this app?',
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
  const [preferredVoice, setPreferredVoice] = useState<PreferredSpeechVoice>({});
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingFeedbackTurnId, setSubmittingFeedbackTurnId] = useState<number | null>(null);
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
        turnId: item.turnId,
        navigationTarget: item.navigationTarget,
        feedbackRating: item.feedbackRating,
      });
    });
    return turns;
  }, [history]);

  const openChatbotTarget = useCallback(
    (target: string | null | undefined) => {
      switch (target) {
        case 'timetable':
          navigation.navigate('StudentSchedule');
          return;
        case 'assignments':
          navigation.navigate('StudentAssignments');
          return;
        case 'message_center':
          navigation.navigate('MessageThreads', { role: 'student' });
          return;
        case 'peer_chats':
          navigation.navigate('StudentPeerDirectory');
          return;
        case 'class_calls':
          navigation.navigate('StudentClassCalls');
          return;
        case 'class_communities':
          navigation.navigate('StudentHome', { targetSection: 'class_communities' });
          return;
        case 'finance':
          navigation.navigate('StudentHome', { targetSection: 'finance' });
          return;
        case 'unit_registration':
          navigation.navigate('StudentHome', { targetSection: 'unit_registration' });
          return;
        case 'chatbot':
          return;
        default:
          navigation.navigate('StudentHome', { targetSection: 'search' });
      }
    },
    [navigation],
  );

  const getNavigationLabel = useCallback((target: string | null | undefined) => {
    switch (target) {
      case 'timetable':
        return 'Open timetable';
      case 'assignments':
        return 'Open assignments';
      case 'message_center':
        return 'Open messages';
      case 'peer_chats':
        return 'Open peer chats';
      case 'class_calls':
        return 'Open class calls';
      case 'class_communities':
        return 'Open class groups';
      case 'finance':
        return 'Open fees';
      case 'unit_registration':
        return 'Open unit registration';
      default:
        return 'Open here';
    }
  }, []);

  const submitFeedback = useCallback(
    async (turnId: number, rating: 'helpful' | 'not_helpful') => {
      if (!state.accessToken || submittingFeedbackTurnId) {
        return;
      }
      const item = history.find((entry) => entry.turnId === turnId);
      if (!item) {
        return;
      }

      setSubmittingFeedbackTurnId(turnId);
      setError(null);
      try {
        await submitChatbotFeedback(state.accessToken, {
          turnId,
          rating,
          queryText: item.question,
          answerText: item.answer,
          visualCue: item.visualCue,
          navigationTarget: item.navigationTarget,
        });
        setHistory((current) =>
          current.map((entry) =>
            entry.turnId === turnId
              ? {
                  ...entry,
                  feedbackRating: rating,
                }
              : entry,
          ),
        );
        setSpeechStatus(
          rating === 'not_helpful'
            ? 'Marked not helpful. This answer is now queued for admin review.'
            : 'Marked helpful. Thanks for the feedback.',
        );
      } catch (feedbackError) {
        if (feedbackError instanceof Error) {
          setError(feedbackError.message);
        } else {
          setError('Unable to save chatbot feedback right now.');
        }
      } finally {
        setSubmittingFeedbackTurnId(null);
      }
    },
    [history, state.accessToken, submittingFeedbackTurnId],
  );

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
        turnId: response.turn_id ?? null,
        navigationTarget: response.navigation_target ?? null,
        feedbackRating: null,
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
      setError(null);
      await speakWithFallback({
        text,
        speechRate: state.user?.speech_rate,
        preferredVoice,
        onStatusChange: setSpeechStatus,
        onError: (message) => {
          setError(message);
        },
      });
    } catch {
      setSpeechStatus('Voice failed. Check device TTS settings.');
      setError(
        preferredVoice.diagnosticMessage ||
          'Voice playback failed on this device. Check media volume and device text-to-speech settings.',
      );
    }
  };

  useEffect(() => {
    prepareSpeechPlayback();
  }, []);

  useEffect(() => {
    let active = true;
    const prepareTtsVoice = async () => {
      const voice = await loadPreferredSpeechVoice();
      if (!active) {
        return;
      }
      setPreferredVoice(voice);
      if (voice.hasUsableVoice === false && voice.diagnosticMessage) {
        setSpeechStatus(voice.diagnosticMessage);
      }
    };
    prepareTtsVoice();
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      stopSpeechPlayback();
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
            {speechStatus ? <Text style={styles.helper}>{speechStatus}</Text> : null}
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
                      {turn.navigationTarget ? (
                        <VoiceButton
                          label={getNavigationLabel(turn.navigationTarget)}
                          icon={<MaterialCommunityIcons name="arrow-top-right" size={20} color={palette.surface} />}
                          iconOnly
                          size="compact"
                          style={styles.iconButton}
                          onPress={() => openChatbotTarget(turn.navigationTarget)}
                          accessibilityHint="Open the screen or section mentioned in this chatbot answer."
                        />
                      ) : null}
                      {turn.turnId ? (
                        <>
                          <VoiceButton
                            label={turn.feedbackRating === 'helpful' ? 'Helpful saved' : 'Helpful'}
                            size="compact"
                            isActive={turn.feedbackRating === 'helpful'}
                            onPress={() => submitFeedback(turn.turnId as number, 'helpful')}
                          />
                          <VoiceButton
                            label={turn.feedbackRating === 'not_helpful' ? 'Review queued' : 'Not helpful'}
                            size="compact"
                            isActive={turn.feedbackRating === 'not_helpful'}
                            onPress={() => submitFeedback(turn.turnId as number, 'not_helpful')}
                          />
                        </>
                      ) : null}
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
              await stopSpeechPlayback();
              await cancelVoiceQuestion();
            },
          },
          {
            label: 'Test voice',
            onPress: () =>
              speakAnswer(
                'Voice test successful. If you do not hear this, turn on Android text to speech and raise media volume.',
              ),
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
