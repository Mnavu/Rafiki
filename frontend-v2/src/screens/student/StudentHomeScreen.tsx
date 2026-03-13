import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { AppMenu, ChatbotBubble, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchClassCalls,
  fetchClassCommunities,
  fetchStudentAssignments,
  fetchStudentFinanceStatuses,
  fetchStudentProfile,
  fetchStudentRegistrations,
  fetchStudentRewards,
  fetchStudentTimetable,
  transcribeAudio,
  type AssignmentSummary,
  type ClassCallSummary,
  type ClassCommunitySummary,
  type FinanceStatusSummary,
  type RegistrationSummary,
  type StudentProfile,
  type StudentRewardsSummary,
  type TimetableEntry,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';
import { roleLabels } from '@app-types/roles';
import { normalizeSpeechText } from '../../utils/speechNormalization';

type StudentOverview = {
  profile: StudentProfile;
  assignments: AssignmentSummary[];
  timetable: TimetableEntry[];
  registrations: RegistrationSummary[];
  financeStatus: FinanceStatusSummary | null;
  rewards: StudentRewardsSummary | null;
  classCalls: ClassCallSummary[];
  classCommunities: ClassCommunitySummary[];
};

type SectionHeaderProps = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onSpeak: () => void;
};

type PictureActionCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
};

type SearchTarget = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  onPress?: () => void;
  disabled?: boolean;
};

const VOICE_SEARCH_SPEECH_THRESHOLD_DB = -45;
const VOICE_SEARCH_SILENCE_MS = 1200;
const VOICE_SEARCH_MIN_DURATION_MS = 800;
const VOICE_SEARCH_MAX_DURATION_MS = 15000;
const VOICE_SEARCH_NO_SPEECH_TIMEOUT_MS = 5500;
const VOICE_SEARCH_NO_METERING_FALLBACK_MS = 5000;

const SEARCH_SYNONYMS: Record<string, string[]> = {
  call: ['communication', 'message', 'chat', 'talk', 'contact', 'video', 'meeting'],
  calls: ['communication', 'message', 'chat', 'talk', 'contact', 'video', 'meeting'],
  chat: ['message', 'communication', 'talk', 'call'],
  chatbot: ['help', 'assistant', 'support', 'question', 'ask'],
  help: ['chatbot', 'assistant', 'support', 'question'],
  assistant: ['chatbot', 'help', 'support'],
  support: ['help', 'assistant', 'chatbot'],
  message: ['chat', 'communication', 'talk', 'call'],
  communicate: ['message', 'chat', 'call', 'talk', 'contact'],
  communication: ['message', 'chat', 'call', 'talk', 'contact'],
  class: ['course', 'unit', 'group', 'meeting', 'timetable', 'schedule'],
  classes: ['course', 'unit', 'group', 'meeting', 'timetable', 'schedule'],
  timetable: ['schedule', 'upcoming', 'classes', 'class', 'entries', 'calendar'],
  schedule: ['timetable', 'upcoming', 'classes', 'calendar'],
  calendar: ['timetable', 'schedule', 'classes', 'upcoming'],
  entry: ['entries', 'timetable', 'schedule'],
  entries: ['entry', 'timetable', 'schedule'],
  group: ['community', 'class', 'forum', 'chat'],
  fees: ['finance', 'payment', 'balance'],
  fee: ['finance', 'payment', 'balance'],
};

const tokenizeSearch = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, onSpeak }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleRow}>
      <MaterialCommunityIcons name={icon} size={22} color={palette.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <VoiceButton
      label="Speak"
      size="compact"
      onPress={onSpeak}
      accessibilityHint={`Reads the ${title} section aloud.`}
    />
  </View>
);

const PictureActionCard: React.FC<PictureActionCardProps> = ({ icon, label, hint, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    activeOpacity={0.8}
    style={styles.pictureCard}
    onPress={onPress}
  >
    <MaterialCommunityIcons name={icon} size={34} color={palette.primary} />
    <Text style={styles.pictureCardLabel}>{label}</Text>
  </TouchableOpacity>
);

const parseMillis = (value: string | null | undefined): number => {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }
  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return date;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No schedule';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No schedule';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatMoney = (value: string): string => {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const StudentHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout, updatePreferences } = useAuth();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchListening, setSearchListening] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRecordingRef = useRef<Audio.Recording | null>(null);
  const searchSpeechDetectedRef = useRef(false);
  const searchLastSpeechMsRef = useRef<number | null>(null);
  const searchAutoStoppingRef = useRef(false);

  const speakText = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) {
        return;
      }
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
        await Speech.stop();
        setSpeechStatus('Speaking...');
        Speech.speak(text, {
          rate: state.user?.speech_rate && state.user.speech_rate > 0 ? state.user.speech_rate : 0.9,
          ...(voiceId ? { voice: voiceId } : {}),
          onDone: () => setSpeechStatus(null),
          onStopped: () => setSpeechStatus(null),
          onError: () => setSpeechStatus('Voice failed. Use Test voice from menu.'),
        });
      } catch {
        setSpeechStatus('Voice failed. Check device TTS settings.');
        Alert.alert(
          'Voice error',
          'Could not play speech on this device right now. Check device media volume and TTS settings.',
        );
      }
    },
    [state.user?.speech_rate, voiceId],
  );

  const loadOverview = useCallback(
    async (isRefresh = false) => {
      if (!state.accessToken || !state.user) {
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const profile = await fetchStudentProfile(state.accessToken, state.user.id);
        const [
          assignments,
          registrations,
          timetable,
          financeStatuses,
          rewards,
          classCalls,
          classCommunities,
        ] = await Promise.all([
          fetchStudentAssignments(state.accessToken),
          fetchStudentRegistrations(state.accessToken),
          fetchStudentTimetable(state.accessToken, profile.programme),
          fetchStudentFinanceStatuses(state.accessToken),
          fetchStudentRewards(state.accessToken, state.user.id).catch(() => null),
          fetchClassCalls(state.accessToken, 'upcoming').catch(() => []),
          fetchClassCommunities(state.accessToken).catch(() => []),
        ]);

        const latestFinance = [...financeStatuses].sort((a, b) => {
          if (a.academic_year !== b.academic_year) {
            return b.academic_year - a.academic_year;
          }
          return b.trimester - a.trimester;
        })[0] ?? null;

        const now = Date.now();
        const upcomingClasses = [...timetable]
          .filter((item) => parseMillis(item.end_datetime) >= now - 60 * 60 * 1000)
          .sort((a, b) => parseMillis(a.start_datetime) - parseMillis(b.start_datetime))
          .slice(0, 4);

        const upcomingAssignments = [...assignments]
          .filter((item) => !!item.due_at)
          .sort((a, b) => parseMillis(a.due_at) - parseMillis(b.due_at))
          .slice(0, 4);

        const upcomingClassCalls = [...classCalls]
          .sort((a, b) => parseMillis(a.start_at) - parseMillis(b.start_at))
          .slice(0, 4);

        setOverview({
          profile,
          assignments: upcomingAssignments,
          timetable: upcomingClasses,
          registrations,
          financeStatus: latestFinance,
          rewards,
          classCalls: upcomingClassCalls,
          classCommunities: classCommunities.slice(0, 8),
        });
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load student dashboard.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken, state.user],
  );

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    }).catch(() => {
      // Keep app usable even if audio mode update fails on some Android devices.
    });
  }, []);

  useEffect(() => {
    let active = true;
    const prepareTts = async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (!active) {
          return;
        }
        if (!voices || voices.length === 0) {
          setVoiceId(undefined);
          return;
        }
        const englishVoice =
          voices.find((voice) => voice.language?.toLowerCase().startsWith('en')) ??
          voices[0];
        setVoiceId(englishVoice?.identifier);
      } catch {
        if (!active) {
          return;
        }
        setVoiceId(undefined);
      }
    };
    prepareTts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
      const activeRecording = searchRecordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => {
          // Ignore recorder cleanup failure on unmount.
        });
        searchRecordingRef.current = null;
      }
    };
  }, []);

  const userName = useMemo(() => {
    return state.user?.display_name?.trim() || state.user?.username || roleLabels.student;
  }, [state.user]);

  const overviewSpeech = useMemo(() => {
    if (!overview) {
      return 'Overview is loading. Please wait.';
    }
    return [
      `Status is ${overview.profile.current_status}.`,
      `Current term is year ${overview.profile.year}, trimester ${overview.profile.trimester}.`,
      `You are registered in ${overview.registrations.length} units.`,
    ].join(' ');
  }, [overview]);

  const classesSpeech = useMemo(() => {
    if (!overview?.timetable.length) {
      return 'No upcoming classes are currently available.';
    }
    const classLines = overview.timetable
      .slice(0, 4)
      .map((entry) => `Class for unit ${entry.unit ?? 'not specified'} at ${formatDateTime(entry.start_datetime)}.`);
    return classLines.join(' ');
  }, [overview?.timetable]);

  const assignmentsSpeech = useMemo(() => {
    if (!overview?.assignments.length) {
      return 'No assignments are due right now.';
    }
    const assignmentLines = overview.assignments
      .slice(0, 4)
      .map((item) => `${item.title}, due ${formatDateTime(item.due_at)}.`);
    return assignmentLines.join(' ');
  }, [overview?.assignments]);

  const financeSpeech = useMemo(() => {
    if (!overview) {
      return 'Finance and rewards data is loading.';
    }
    const feeLine = overview.financeStatus
      ? `Fee status: paid ${formatMoney(overview.financeStatus.total_paid)} of ${formatMoney(overview.financeStatus.total_due)}.`
      : 'No finance records found yet.';
    const rewardsLine = overview.rewards
      ? `Rewards: ${overview.rewards.stars} stars earned with ${overview.rewards.history.length} merit records.`
      : `Current stars are ${overview.profile.stars}.`;
    return `${feeLine} ${rewardsLine}`;
  }, [overview]);

  const communitySpeech = useMemo(() => {
    if (!overview?.classCommunities.length) {
      return 'No class communities are available yet.';
    }
    return `You have ${overview.classCommunities.length} class communities. Open one to chat with your lecturer and classmates.`;
  }, [overview?.classCommunities]);

  const callsSpeech = useMemo(() => {
    if (!overview?.classCalls.length) {
      return 'No upcoming class calls right now.';
    }
    return overview.classCalls
      .map((call) => `${call.unit_code} call starts at ${formatDateTime(call.start_at)}.`)
      .join(' ');
  }, [overview?.classCalls]);

  const searchTargets = useMemo<SearchTarget[]>(() => {
    const targets: SearchTarget[] = [
      {
        id: 'upcoming-classes',
        title: 'Upcoming classes',
        subtitle: 'View timetable entries and upcoming class times.',
        keywords: ['timetable', 'schedule', 'upcoming classes', 'entries', 'calendar', 'class times'],
        disabled: true,
      },
      {
        id: 'finance-and-rewards',
        title: 'Finance and rewards',
        subtitle: 'Open fee status and rewards information.',
        keywords: ['fees', 'fee', 'finance', 'payment', 'balance', 'wallet', 'rewards'],
        onPress: () => speakText(financeSpeech),
      },
      {
        id: 'class-communities',
        title: 'Class communities',
        subtitle: 'Open your class groups with lecturers and classmates.',
        keywords: ['group', 'groups', 'class community', 'class communities', 'community', 'forum', 'chat'],
        onPress: () => {
          if (overview?.classCommunities.length) {
            const first = overview.classCommunities[0];
            navigation.navigate('ClassCommunityDetail', {
              chatroomId: first.chatroom_id,
              unitTitle: `${first.unit_code} - ${first.unit_title}`,
              meetingUrl: first.upcoming_call?.meeting_url || undefined,
            });
            return;
          }
          speakText('No class communities are available right now.');
        },
      },
      {
        id: 'message-center',
        title: 'Message center',
        subtitle: 'Open channels with lecturers and keep history.',
        keywords: ['message', 'chat', 'lecturer', 'guardian', 'communication', 'call', 'talk', 'contact'],
        onPress: () => navigation.navigate('MessageThreads', { role: 'student' }),
      },
      {
        id: 'chatbot-help',
        title: 'Help chatbot',
        subtitle: 'Ask course and timetable questions anytime.',
        keywords: ['help', 'chatbot', 'assistant', 'support', 'question', 'course help'],
        onPress: () => navigation.navigate('StudentChatbot'),
      },
      {
        id: 'peer-chats',
        title: 'Private classmate chats',
        subtitle: 'Start one-to-one chats with classmates.',
        keywords: ['peer', 'classmate', 'student', 'chat', 'friend', 'talk', 'message'],
        onPress: () => navigation.navigate('StudentPeerDirectory'),
      },
    ];

    if (!overview) {
      return targets;
    }

    overview.classCalls.forEach((call) => {
      targets.push({
        id: `class-call-${call.id}`,
        title: `${call.unit_code} class call`,
        subtitle: `Starts ${formatDateTime(call.start_at)}`,
        keywords: ['class', 'call', 'video', call.unit_code, call.unit_title],
        onPress: () =>
          navigation.navigate('VideoRoom', {
            meetingUrl: call.meeting_url,
            title: `${call.unit_code} call`,
          }),
      });
    });

    overview.timetable.forEach((entry) => {
      targets.push({
        id: `timetable-entry-${entry.id}`,
        title: `Timetable entry: Unit #${entry.unit ?? 'N/A'}`,
        subtitle: `${formatDateTime(entry.start_datetime)} | Room ${entry.room}`,
        keywords: [
          'timetable',
          'schedule',
          'upcoming classes',
          'class entry',
          'calendar',
          entry.room,
          String(entry.unit ?? ''),
        ],
        disabled: true,
      });
    });

    overview.classCommunities.forEach((community) => {
      targets.push({
        id: `community-${community.chatroom_id}`,
        title: `${community.unit_code} class group`,
        subtitle: `${community.students_count} students, ${community.lecturers_count} lecturers`,
        keywords: ['group', 'community', 'class', community.unit_code, community.unit_title],
        onPress: () =>
          navigation.navigate('ClassCommunityDetail', {
            chatroomId: community.chatroom_id,
            unitTitle: `${community.unit_code} - ${community.unit_title}`,
            meetingUrl: community.upcoming_call?.meeting_url || undefined,
          }),
      });
    });

    overview.assignments.forEach((assignment) => {
      targets.push({
        id: `assignment-${assignment.id}`,
        title: assignment.title,
        subtitle: `Due ${formatDateTime(assignment.due_at)}`,
        keywords: ['assignment', 'homework', assignment.unit_title, assignment.title],
        disabled: true,
      });
    });

    if (overview.financeStatus) {
      targets.push({
        id: 'fees-status',
        title: 'Fee status',
        subtitle: `Paid ${formatMoney(overview.financeStatus.total_paid)} of ${formatMoney(overview.financeStatus.total_due)}`,
        keywords: ['fee', 'finance', 'payment', 'balance'],
        disabled: true,
      });
    }

    return targets;
  }, [financeSpeech, navigation, overview, speakText]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return [];
    }
    const directTokens = tokenizeSearch(q);
    const expandedTokens = new Set(directTokens);
    directTokens.forEach((token) => {
      (SEARCH_SYNONYMS[token] ?? []).forEach((alias) => expandedTokens.add(alias));
    });

    return searchTargets
      .map((target) => {
        const combined = `${target.title} ${target.subtitle} ${target.keywords.join(' ')}`.toLowerCase();
        let score = 0;
        if (combined.includes(q)) {
          score += 8;
        }
        directTokens.forEach((token) => {
          if (combined.includes(token)) {
            score += 4;
          }
        });
        expandedTokens.forEach((token) => {
          if (!directTokens.includes(token) && combined.includes(token)) {
            score += 2;
          }
        });
        return { ...target, score };
      })
      .filter((target) => target.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 12)
      .map(({ score: _score, ...target }) => target);
  }, [searchQuery, searchTargets]);

  const stopVoiceSearch = useCallback(
    async (reason: 'manual' | 'silence' | 'max' | 'fallback' = 'manual') => {
      const activeRecording = searchRecordingRef.current;
      if (!activeRecording || searchAutoStoppingRef.current) {
        return;
      }
      searchAutoStoppingRef.current = true;
      setSearchBusy(true);
      try {
        await activeRecording.stopAndUnloadAsync();
        const uri = activeRecording.getURI();
        searchRecordingRef.current = null;
        setSearchListening(false);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        if (!uri || !state.accessToken) {
          throw new Error('No recorded audio available for transcription.');
        }
        setSpeechStatus('Converting speech to text...');
        const transcription = await transcribeAudio(state.accessToken, { audioUri: uri });
        const transcribedText = normalizeSpeechText(transcription.text || '').trim();
        if (!transcribedText) {
          setSearchError('No words were recognized. Please try again.');
          setSpeechStatus(
            reason === 'silence'
              ? 'No speech detected clearly. Try speaking a little louder.'
              : 'No words were recognized. Please try again.',
          );
          return;
        }
        setSearchQuery(transcribedText);
        setSpeechStatus(`Heard: ${transcribedText}`);
      } catch (voiceError) {
        if (voiceError instanceof Error) {
          setSearchError(voiceError.message);
        } else {
          setSearchError('Unable to process voice search.');
        }
        setSpeechStatus('Voice search failed. You can still type in the search box.');
      } finally {
        searchSpeechDetectedRef.current = false;
        searchLastSpeechMsRef.current = null;
        searchAutoStoppingRef.current = false;
        setSearchBusy(false);
      }
    },
    [state.accessToken],
  );

  const startVoiceSearch = useCallback(async () => {
    if (searchBusy || searchListening) {
      return;
    }
    try {
      setSearchError(null);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setSearchError('Microphone permission is required for voice search.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      searchSpeechDetectedRef.current = false;
      searchLastSpeechMsRef.current = null;
      searchAutoStoppingRef.current = false;

      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status) => {
          if (!status?.isRecording || searchAutoStoppingRef.current) {
            return;
          }
          const now = Date.now();
          const duration = status.durationMillis ?? 0;
          const metering = typeof status.metering === 'number' ? status.metering : null;

          if (duration >= VOICE_SEARCH_MAX_DURATION_MS) {
            void stopVoiceSearch('max');
            return;
          }

          if (metering === null) {
            if (duration >= VOICE_SEARCH_NO_METERING_FALLBACK_MS) {
              void stopVoiceSearch('fallback');
            }
            return;
          }

          if (metering > VOICE_SEARCH_SPEECH_THRESHOLD_DB) {
            searchSpeechDetectedRef.current = true;
            searchLastSpeechMsRef.current = now;
            return;
          }

          if (!searchSpeechDetectedRef.current && duration >= VOICE_SEARCH_NO_SPEECH_TIMEOUT_MS) {
            void stopVoiceSearch('silence');
            return;
          }

          if (
            searchSpeechDetectedRef.current &&
            searchLastSpeechMsRef.current &&
            duration >= VOICE_SEARCH_MIN_DURATION_MS &&
            now - searchLastSpeechMsRef.current >= VOICE_SEARCH_SILENCE_MS
          ) {
            void stopVoiceSearch('silence');
          }
        },
        200,
      );
      searchRecordingRef.current = recording;
      setSearchListening(true);
      setSpeechStatus('Listening... speak and pause to search automatically.');
    } catch (voiceError) {
      if (voiceError instanceof Error) {
        setSearchError(voiceError.message);
      } else {
        setSearchError('Unable to start voice search.');
      }
      setSearchListening(false);
    }
  }, [searchBusy, searchListening, stopVoiceSearch]);

  const toggleVoiceSearch = useCallback(async () => {
    if (searchListening) {
      await stopVoiceSearch('manual');
    } else {
      await startVoiceSearch();
    }
  }, [searchListening, startVoiceSearch, stopVoiceSearch]);

  if (loading && !overview) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading your student workspace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadOverview(true)} />
        }
      >
        <GreetingHeader
          name={userName}
          greeting="Student workspace"
          rightAccessory={<RoleBadge role="student" />}
        />

        {speechStatus ? (
          <View style={styles.speechStatusCard}>
            <Text style={styles.speechStatusText}>{speechStatus}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Search"
            icon="magnify"
            onSpeak={() =>
              speakText(
                'Use the search box to find classes, assignments, groups, fees, and communication tools. You can also use voice search.',
              )
            }
          />
          <View style={styles.searchCard}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search what you need..."
              placeholderTextColor={palette.textSecondary}
            />
            <View style={styles.searchActions}>
              <VoiceButton
                label={searchListening ? 'Listening. Tap to stop' : 'Voice search'}
                icon={
                  <MaterialCommunityIcons
                    name={searchListening ? 'microphone-off' : 'microphone'}
                    size={20}
                    color={palette.surface}
                  />
                }
                iconOnly
                size="compact"
                style={styles.searchIconButton}
                onPress={toggleVoiceSearch}
                isActive={searchListening || searchBusy}
                accessibilityHint="Start voice search. The app auto-detects when you finish speaking."
              />
              <VoiceButton
                label={searchBusy ? 'Processing...' : 'Clear'}
                icon={<MaterialCommunityIcons name="close-circle-outline" size={20} color={palette.surface} />}
                iconOnly
                size="compact"
                style={styles.searchIconButton}
                onPress={() => {
                  if (searchBusy) {
                    return;
                  }
                  setSearchQuery('');
                  setSearchError(null);
                  setSpeechStatus(null);
                }}
                accessibilityHint="Clear search text and voice status."
              />
            </View>
            <Text style={styles.searchIconLegend}>Voice | Clear</Text>
            <Text style={styles.searchHelper}>
              {searchListening
                ? 'Listening now. Pause after speaking and results will load automatically.'
                : 'Tap voice search, speak naturally, and pause. The app auto-detects when you stop.'}
            </Text>
            {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
          </View>

          {searchQuery.trim() ? (
            searchResults.length ? (
              searchResults.map((result, index) => (
                <DashboardTile
                  key={`search-result-${result.id}-${index}`}
                  title={result.title}
                  subtitle={result.subtitle}
                  onPress={result.onPress}
                  disabled={result.disabled}
                />
              ))
            ) : (
              <DashboardTile
                title="No matching results"
                subtitle="Try different words, or use voice search again."
                disabled
              />
            )
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh all student data</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadOverview(true)} />
          </View>
        ) : null}

        {overview ? (
          <View style={styles.section}>
            <SectionHeader
              title="Picture quick actions"
              icon="image-filter-center-focus"
              onSpeak={() =>
                speakText(
                  'Quick picture actions. Open classes, class communities, message center, help chatbot, and private peer chats.',
                )
              }
            />
            <View style={styles.pictureGrid}>
              <PictureActionCard
                icon="video-wireless"
                label="Class calls"
                hint="Opens your upcoming class calls."
                onPress={() => {
                  if (overview.classCalls.length > 0) {
                    const first = overview.classCalls[0];
                    navigation.navigate('VideoRoom', {
                      meetingUrl: first.meeting_url,
                      title: `${first.unit_code} call`,
                    });
                    return;
                  }
                  speakText('No upcoming class calls at the moment.');
                }}
              />
              <PictureActionCard
                icon="account-group"
                label="Class groups"
                hint="Opens your first available class community."
                onPress={() => {
                  if (overview.classCommunities.length > 0) {
                    const first = overview.classCommunities[0];
                    navigation.navigate('ClassCommunityDetail', {
                      chatroomId: first.chatroom_id,
                      unitTitle: `${first.unit_code} - ${first.unit_title}`,
                      meetingUrl: first.upcoming_call?.meeting_url || undefined,
                    });
                    return;
                  }
                  speakText('No class groups are available yet.');
                }}
              />
              <PictureActionCard
                icon="chat-processing"
                label="Message center"
                hint="Opens your main lecturer and guardian message threads."
                onPress={() => navigation.navigate('MessageThreads', { role: 'student' })}
              />
              <PictureActionCard
                icon="robot-outline"
                label="Help chatbot"
                hint="Opens the student help chatbot for course and schedule questions."
                onPress={() => navigation.navigate('StudentChatbot')}
              />
              <PictureActionCard
                icon="account-multiple"
                label="Peer chats"
                hint="Opens private chat directory for classmates."
                onPress={() => navigation.navigate('StudentPeerDirectory')}
              />
            </View>
          </View>
        ) : null}

        {overview ? (
          <View style={styles.section}>
            <SectionHeader title="Overview" icon="account-school" onSpeak={() => speakText(overviewSpeech)} />
            <View style={styles.metricsCard}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Status</Text>
                <Text style={styles.metricValue}>{overview.profile.current_status}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Current term</Text>
                <Text style={styles.metricValue}>
                  Year {overview.profile.year} / Trimester {overview.profile.trimester}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Registered units</Text>
                <Text style={styles.metricValue}>{overview.registrations.length}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Upcoming classes" icon="calendar-clock" onSpeak={() => speakText(classesSpeech)} />
          {overview?.timetable.length ? (
            overview.timetable.map((entry, index) => (
              <DashboardTile
                key={`timetable-${entry.id}-${index}`}
                icon={<MaterialCommunityIcons name="book-open-variant" size={26} color={palette.primary} />}
                title={`Unit #${entry.unit ?? 'N/A'}`}
                subtitle={`${formatDateTime(entry.start_datetime)}  |  Room ${entry.room}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="calendar-remove" size={26} color={palette.textSecondary} />}
              title="No upcoming timetable entries"
              subtitle="Timetable will appear here once your programme schedule is published."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Assignments" icon="clipboard-text-clock" onSpeak={() => speakText(assignmentsSpeech)} />
          {overview?.assignments.length ? (
            overview.assignments.map((assignment, index) => (
              <DashboardTile
                key={`assignment-${assignment.id}-${index}`}
                icon={<MaterialCommunityIcons name="clipboard-check" size={26} color={palette.secondary} />}
                title={assignment.title}
                subtitle={`${assignment.unit_title}  |  Due ${formatDateTime(assignment.due_at)}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="clipboard-remove" size={26} color={palette.textSecondary} />}
              title="No assignments due"
              subtitle="Your upcoming assignments will show here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Class calls" icon="video-wireless" onSpeak={() => speakText(callsSpeech)} />
          {overview?.classCalls.length ? (
            overview.classCalls.map((call, index) => (
              <DashboardTile
                key={`class-call-${call.id}-${index}`}
                icon={<MaterialCommunityIcons name="video" size={26} color={palette.primary} />}
                title={`${call.unit_code} live class`}
                subtitle={`${formatDateTime(call.start_at)} | Tap to join`}
                onPress={() =>
                  navigation.navigate('VideoRoom', {
                    meetingUrl: call.meeting_url,
                    title: `${call.unit_code} call`,
                  })
                }
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="video-off" size={26} color={palette.textSecondary} />}
              title="No upcoming class calls"
              subtitle="When your lecturer schedules a call, it will appear here."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Class communities" icon="account-group" onSpeak={() => speakText(communitySpeech)} />
          {overview?.classCommunities.length ? (
            overview.classCommunities.map((community, index) => (
              <DashboardTile
                key={`community-${community.chatroom_id}-${index}`}
                icon={<MaterialCommunityIcons name="forum" size={26} color={palette.primary} />}
                title={`${community.unit_code} group chat`}
                subtitle={`${community.students_count} students, ${community.lecturers_count} lecturers`}
                onPress={() =>
                  navigation.navigate('ClassCommunityDetail', {
                    chatroomId: community.chatroom_id,
                    unitTitle: `${community.unit_code} - ${community.unit_title}`,
                    meetingUrl: community.upcoming_call?.meeting_url || undefined,
                  })
                }
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="forum-remove" size={26} color={palette.textSecondary} />}
              title="No class communities yet"
              subtitle="Approved classes will create your group channels automatically."
              disabled
            />
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Finance and rewards" icon="wallet" onSpeak={() => speakText(financeSpeech)} />
          <DashboardTile
            icon={<MaterialCommunityIcons name="cash-check" size={26} color={palette.success} />}
            title="Fee status"
            subtitle={
              overview?.financeStatus
                ? `Paid ${formatMoney(overview.financeStatus.total_paid)} of ${formatMoney(overview.financeStatus.total_due)}`
                : 'No finance records found yet.'
            }
            disabled
          />
          <DashboardTile
            icon={<MaterialCommunityIcons name="star-circle" size={26} color={palette.warning} />}
            title="Rewards"
            subtitle={
              overview?.rewards
                ? `${overview.rewards.stars} stars earned, ${overview.rewards.history.length} merit entries.`
                : `Current stars: ${overview?.profile.stars ?? 0}`
            }
            disabled
          />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Communication"
            icon="message-processing"
            onSpeak={() =>
              speakText(
                'Communication options available. Open message center for lecturer threads, open chatbot for quick help, or open peer chats for private classmate conversations.',
              )
            }
          />
          <DashboardTile
            icon={<MaterialCommunityIcons name="chat-processing" size={26} color={palette.primary} />}
            title="Message center"
            subtitle="Open channels with lecturers and keep conversation history."
            onPress={() => navigation.navigate('MessageThreads', { role: 'student' })}
          />
          <DashboardTile
            icon={<MaterialCommunityIcons name="account-multiple" size={26} color={palette.primary} />}
            title="Private classmate chats"
            subtitle="Start 1:1 conversations with peers in your approved classes."
            onPress={() => navigation.navigate('StudentPeerDirectory')}
          />
          <DashboardTile
            icon={<MaterialCommunityIcons name="robot-outline" size={26} color={palette.primary} />}
            title="Help chatbot"
            subtitle="Ask the student assistant about class timing, calls, and course questions."
            onPress={() => navigation.navigate('StudentChatbot')}
          />
        </View>
      </ScrollView>

      <ChatbotBubble onPress={() => navigation.navigate('StudentChatbot')} />
      <AppMenu
        actions={[
          {
            label: 'Classes',
            onPress: () => {
              if (overview?.classCommunities.length) {
                const first = overview.classCommunities[0];
                navigation.navigate('ClassCommunityDetail', {
                  chatroomId: first.chatroom_id,
                  unitTitle: `${first.unit_code} - ${first.unit_title}`,
                  meetingUrl: first.upcoming_call?.meeting_url || undefined,
                });
              }
            },
          },
          {
            label: 'Message center',
            onPress: () => navigation.navigate('MessageThreads', { role: 'student' }),
          },
          {
            label: 'Help chatbot',
            onPress: () => navigation.navigate('StudentChatbot'),
          },
          { label: 'Refresh', onPress: () => loadOverview(true) },
          { label: 'Log out', onPress: logout },
          {
            label: 'Test voice',
            onPress: () =>
              speakText('Voice test successful. Student assistant is ready to read sections aloud.'),
          },
          { label: 'Stop voice', onPress: () => Speech.stop() },
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
    flexShrink: 1,
  },
  metricsCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  metricLabel: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.body,
    color: palette.textPrimary,
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
  pictureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pictureCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.disabled,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 108,
  },
  pictureCardLabel: {
    ...typography.body,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  speechStatusCard: {
    backgroundColor: '#E8F1FF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  speechStatusText: {
    ...typography.helper,
    color: palette.primary,
  },
  searchCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: palette.disabled,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.textPrimary,
    backgroundColor: palette.background,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchIconButton: {
    width: 48,
    height: 48,
  },
  searchIconLegend: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  searchHelper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  searchError: {
    ...typography.helper,
    color: palette.danger,
  },
  actions: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    backgroundColor: palette.background,
  },
  menuToggleButton: {
    flexBasis: '100%',
  },
  actionButton: {
    flexBasis: '48%',
    flexGrow: 1,
  },
});
