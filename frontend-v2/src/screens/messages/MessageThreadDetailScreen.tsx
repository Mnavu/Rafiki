import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  buildCommunicationMessageAudioSource,
  createCommunicationMessage,
  fetchCommunicationThreads,
  fetchStudentAssignments,
  fetchStudentProfile,
  transcribeAudio,
  type CommunicationMessage,
  type CommunicationThread,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { formatThreadTitle, formatUserLabel, buildParticipantTrack } from './participantLabels';

type ThreadDetailRoute = RouteProp<RootStackParamList, 'MessageThreadDetail'>;

const parseMillis = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No timestamp';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No timestamp';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const MessageThreadDetailScreen: React.FC = () => {
  const route = useRoute<ThreadDetailRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();

  const { role, threadId } = route.params;
  const [thread, setThread] = useState<CommunicationThread | null>(null);
  const [studentYearByUserId, setStudentYearByUserId] = useState<Record<number, number | null>>(
    {},
  );
  const [lecturerUnitTitle, setLecturerUnitTitle] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const cleanupPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore cleanup failure.
      }
      soundRef.current = null;
    }
    setPlayingMessageId(null);
  }, []);

  const loadThread = useCallback(
    async (isRefresh = false) => {
      if (!state.accessToken) {
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [threads, assignments] = await Promise.all([
          fetchCommunicationThreads(state.accessToken),
          role === 'lecturer'
            ? fetchStudentAssignments(state.accessToken).catch(() => [])
            : Promise.resolve([]),
        ]);
        const currentThread = threads.find((item) => item.id === threadId) ?? null;
        setThread(currentThread);
        setLecturerUnitTitle(assignments[0]?.unit_title ?? null);

        if (currentThread) {
          const studentIds = new Set<number>();
          if (currentThread.student_detail?.id) {
            studentIds.add(currentThread.student_detail.id);
          } else if (currentThread.student) {
            studentIds.add(currentThread.student);
          }
          const yearPairs = await Promise.all(
            [...studentIds].map(async (studentUserId) => {
              try {
                const profile = await fetchStudentProfile(state.accessToken!, studentUserId);
                return [studentUserId, profile.year] as const;
              } catch {
                return [studentUserId, null] as const;
              }
            }),
          );
          setStudentYearByUserId(
            yearPairs.reduce<Record<number, number | null>>((acc, [studentUserId, year]) => {
              acc[studentUserId] = year;
              return acc;
            }, {}),
          );
        } else {
          setStudentYearByUserId({});
        }
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load thread details.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role, state.accessToken, threadId],
  );

  useEffect(() => {
    loadThread(false);
    return () => {
      cleanupPlayback();
    };
  }, [cleanupPlayback, loadThread]);

  const sortedMessages = useMemo(() => {
    if (!thread) {
      return [];
    }
    return [...thread.messages].sort(
      (left, right) => parseMillis(left.created_at) - parseMillis(right.created_at),
    );
  }, [thread]);

  const participantTrack = useMemo(() => {
    if (!thread) {
      return [];
    }
    return buildParticipantTrack(thread, {
      viewerUserId: state.user?.id,
      studentYearByUserId,
      lecturerUnitTitle,
    });
  }, [lecturerUnitTitle, state.user?.id, studentYearByUserId, thread]);

  const threadTitle = useMemo(() => {
    if (route.params.threadTitle) {
      return route.params.threadTitle;
    }
    if (!thread) {
      return `Thread #${threadId}`;
    }
    return formatThreadTitle(thread, role, {
      viewerUserId: state.user?.id,
      studentYearByUserId,
      lecturerUnitTitle,
    });
  }, [
    lecturerUnitTitle,
    role,
    route.params.threadTitle,
    state.user?.id,
    studentYearByUserId,
    thread,
    threadId,
  ]);

  const playVoiceMessage = useCallback(
    async (message: CommunicationMessage) => {
      if (!message.audio && !state.accessToken) {
        return;
      }
      const sources = [];
      if (state.accessToken) {
        sources.push(buildCommunicationMessageAudioSource(state.accessToken, message.id));
      }
      if (message.audio) {
        sources.push({ uri: message.audio });
      }
      try {
        await cleanupPlayback();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        let sound: Audio.Sound | null = null;
        let lastPlaybackError: unknown = null;
        for (const source of sources) {
          try {
            const loaded = await Audio.Sound.createAsync(
              source as any,
              { shouldPlay: true, progressUpdateIntervalMillis: 500 },
            );
            sound = loaded.sound;
            break;
          } catch (sourceError) {
            lastPlaybackError = sourceError;
          }
        }
        if (!sound) {
          throw lastPlaybackError ?? new Error('Unable to load voice note.');
        }
        soundRef.current = sound;
        setPlayingMessageId(message.id);
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            return;
          }
          if (status.didJustFinish) {
            cleanupPlayback();
          }
        });
      } catch (playbackError) {
        if (playbackError instanceof Error) {
          setError(playbackError.message);
        } else {
          setError('Unable to play voice note.');
        }
      }
    },
    [cleanupPlayback, state.accessToken],
  );

  const sendTextMessage = async () => {
    if (!state.accessToken || !thread || sending) {
      return;
    }
    const body = textDraft.trim();
    if (!body) {
      return;
    }
    setSending(true);
    try {
      await createCommunicationMessage(state.accessToken, {
        threadId: thread.id,
        body,
      });
      setTextDraft('');
      await loadThread(true);
    } catch (sendError) {
      if (sendError instanceof Error) {
        setError(sendError.message);
      } else {
        setError('Unable to send message.');
      }
    } finally {
      setSending(false);
    }
  };

  const stopVoiceRecording = async () => {
    if (!state.accessToken || !thread || !recording) {
      return;
    }
    setSending(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingActive(false);
      setSpeechStatus('Voice note recorded. Converting speech to text...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (!uri) {
        throw new Error('Recording file is unavailable.');
      }
      const transcriptResponse = await transcribeAudio(state.accessToken, { audioUri: uri });
      const transcript = transcriptResponse.text?.trim() ?? '';
      await createCommunicationMessage(state.accessToken, {
        threadId: thread.id,
        audioUri: uri,
        transcript,
      });
      setSpeechStatus(
        transcript
          ? 'Voice note sent with transcript.'
          : 'Voice note sent. Speech was not clearly transcribed.',
      );
      await loadThread(true);
    } catch (recordError) {
      setSpeechStatus(null);
      if (recordError instanceof Error) {
        setError(recordError.message);
      } else {
        setError('Unable to send voice note.');
      }
    } finally {
      setSending(false);
    }
  };

  const startVoiceRecording = async () => {
    if (sending) {
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required for voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording: activeRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(activeRecording);
      setRecordingActive(true);
      setSpeechStatus('Recording voice note...');
    } catch (recordError) {
      setSpeechStatus(null);
      if (recordError instanceof Error) {
        setError(recordError.message);
      } else {
        setError('Unable to start voice recording.');
      }
    }
  };

  const renderMessageTitle = (message: CommunicationMessage): string => {
    if (message.author_detail) {
      return formatUserLabel(message.author_detail, {
        viewerUserId: state.user?.id,
        studentYearByUserId,
        threadStudentName: thread?.student_detail?.display_name || thread?.student_detail?.username,
        lecturerUnitTitle,
      });
    }
    return `User #${message.author}`;
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading thread details...</Text>
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.container}>
        <View style={styles.loader}>
          <Text style={styles.errorTitle}>This thread is no longer available.</Text>
        </View>
        <View style={styles.actions}>
          <VoiceButton label="Back to channels" onPress={() => navigation.goBack()} />
          <VoiceButton label="Log out" onPress={logout} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadThread(true)} />}
      >
        <GreetingHeader name={threadTitle} greeting="Thread detail" rightAccessory={<RoleBadge role={role} />} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.participantsCard}>
            {participantTrack.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.participantLine}>
                - {line}
              </Text>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Communication error</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadThread(true)} />
          </View>
        ) : null}

        {speechStatus ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{speechStatus}</Text>
          </View>
        ) : null}

        {role === 'student' ? (
          <View style={styles.section}>
            <DashboardTile
              title="Need help? Open chatbot"
              subtitle="Ask a quick question about timetable, calls, or your course."
              onPress={() => navigation.navigate('StudentChatbot')}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message history</Text>
          {sortedMessages.length ? (
            sortedMessages.map((message, index) => {
              const mine = message.author === state.user?.id;
              const hasVoice = !!message.audio;
              const body = message.body?.trim() || message.transcript?.trim() || '';
              return (
                <View
                  key={`thread-message-${message.id}-${index}`}
                  style={[styles.messageCard, mine ? styles.messageMine : styles.messageOther]}
                >
                  <Text style={styles.messageAuthor}>{renderMessageTitle(message)}</Text>
                  <Text style={styles.messageTime}>{formatDateTime(message.created_at)}</Text>
                  {body ? <Text style={styles.messageBody}>{body}</Text> : null}
                  {hasVoice ? (
                    <VoiceButton
                      label={playingMessageId === message.id ? 'Playing voice...' : 'Play voice note'}
                      onPress={() => playVoiceMessage(message)}
                    />
                  ) : null}
                </View>
              );
            })
          ) : (
            <DashboardTile
              title="No messages yet"
              subtitle="Send text or voice to start this communication history."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send text message</Text>
          <View style={styles.composeCard}>
            <TextInput
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Type your message"
              placeholderTextColor={palette.textSecondary}
              multiline
              style={styles.textInput}
            />
            <VoiceButton label={sending ? 'Sending...' : 'Send text'} onPress={sendTextMessage} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice notes</Text>
          <View style={styles.composeCard}>
            <Text style={styles.voiceHelper}>
              {recordingActive
                ? 'Recording in progress. Stop to upload voice note.'
                : 'Tap record to capture and upload a voice note.'}
            </Text>
            <VoiceButton
              label={recordingActive ? 'Stop and send voice note' : 'Record voice note'}
              onPress={recordingActive ? stopVoiceRecording : startVoiceRecording}
            />
          </View>
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          ...(role === 'student'
            ? [{ label: 'Help chatbot', onPress: () => navigation.navigate('StudentChatbot') }]
            : []),
          { label: 'Refresh thread', onPress: () => loadThread(true) },
          { label: 'Back to channels', onPress: () => navigation.goBack() },
          { label: 'Log out', onPress: logout },
        ]}
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: spacing.md,
    padding: spacing.lg,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
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
  participantsCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  participantLine: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  messageCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  messageMine: {
    borderColor: palette.primary,
    borderWidth: 2,
  },
  messageOther: {
    borderColor: 'transparent',
    borderWidth: 2,
  },
  messageAuthor: {
    ...typography.helper,
    color: palette.textPrimary,
  },
  messageTime: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  messageBody: {
    ...typography.body,
    color: palette.textPrimary,
  },
  composeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  textInput: {
    ...typography.body,
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    padding: spacing.md,
    color: palette.textPrimary,
    textAlignVertical: 'top',
    backgroundColor: palette.background,
  },
  voiceHelper: {
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
  statusCard: {
    backgroundColor: '#E8F1FF',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statusText: {
    ...typography.helper,
    color: palette.primary,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
