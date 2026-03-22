import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, ChatbotBubble, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  fetchClassCalls,
  fetchClassCommunities,
  fetchFinancePayments,
  fetchProgrammeCurriculum,
  fetchStudentAssignments,
  fetchStudentFinanceStatuses,
  fetchStudentProfile,
  fetchStudentRegistrations,
  fetchStudentRewards,
  fetchTermOfferings,
  fetchStudentTimetable,
  submitStudentUnitSelection,
  transcribeAudio,
  type AssignmentSummary,
  type ClassCallSummary,
  type ClassCommunitySummary,
  type FinanceStatusSummary,
  type PaymentSummary,
  type ProgrammeCurriculumUnit,
  type RegistrationSummary,
  type StudentProfile,
  type StudentRewardsSummary,
  type TermOfferingSummary,
  type TimetableEntry,
} from '@services/api';
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

type StudentOverview = {
  profile: StudentProfile;
  assignments: AssignmentSummary[];
  timetable: TimetableEntry[];
  registrations: RegistrationSummary[];
  financeStatus: FinanceStatusSummary | null;
  payments: PaymentSummary[];
  rewards: StudentRewardsSummary | null;
  classCalls: ClassCallSummary[];
  classCommunities: ClassCommunitySummary[];
  offeredUnits: ProgrammeCurriculumUnit[];
  offeredUnitMeta: Record<
    number,
    {
      trimester: number;
      academicYear: number;
    }
  >;
};

type SectionHeaderProps = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onSpeak: () => void;
};

type PictureActionCardProps = {
  image: ImageSourcePropType;
  label: string;
  hint: string;
  accentColor: string;
  onPress: () => void;
};

type VisualNavigatorCardProps = {
  id?: string;
  image: ImageSourcePropType;
  label: string;
  cue: string;
  accentColor: string;
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

type StudentHomeRoute = RouteProp<RootStackParamList, 'StudentHome'>;
type StudentSectionKey =
  | 'search'
  | 'overview'
  | 'unit_registration'
  | 'timetable'
  | 'assignments'
  | 'class_calls'
  | 'class_communities'
  | 'finance'
  | 'communication';

const VOICE_SEARCH_SPEECH_THRESHOLD_DB = -45;
const VOICE_SEARCH_SILENCE_MS = 1200;
const VOICE_SEARCH_MIN_DURATION_MS = 800;
const VOICE_SEARCH_MAX_DURATION_MS = 15000;
const VOICE_SEARCH_NO_SPEECH_TIMEOUT_MS = 5500;
const VOICE_SEARCH_NO_METERING_FALLBACK_MS = 5000;
const MAX_UNIT_SELECTION = 4;
const UNIT_SELECTION_ALLOWED_STATUSES = ['finance_ok', 'pending_hod', 'active'];

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

const PictureActionCard: React.FC<PictureActionCardProps> = ({
  image,
  label,
  hint,
  accentColor,
  onPress,
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    activeOpacity={0.8}
    style={styles.pictureCard}
    onPress={onPress}
  >
    <View style={[styles.pictureCardImage, { backgroundColor: accentColor }]}>
      <Image source={image} style={styles.pictureCardAsset} resizeMode="contain" />
    </View>
    <Text style={styles.pictureCardLabel}>{label}</Text>
    <Text style={styles.pictureCardHint}>{hint}</Text>
  </TouchableOpacity>
);

const VisualNavigatorCard: React.FC<VisualNavigatorCardProps> = ({
  image,
  label,
  cue,
  accentColor,
  onPress,
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={cue}
    activeOpacity={0.85}
    style={styles.visualNavigatorCard}
    onPress={onPress}
  >
    <View style={[styles.visualNavigatorImage, { backgroundColor: accentColor }]}>
      <Image source={image} style={styles.visualNavigatorAsset} resizeMode="contain" />
    </View>
    <Text style={styles.visualNavigatorLabel}>{label}</Text>
    <Text style={styles.visualNavigatorCue}>{cue}</Text>
  </TouchableOpacity>
);

const studentVisualAssets = {
  classes: require('../../../assets/student-visuals/classes.png'),
  assignments: require('../../../assets/student-visuals/assignments.png'),
  fees: require('../../../assets/student-visuals/fees.png'),
  groups: require('../../../assets/student-visuals/groups.png'),
  messages: require('../../../assets/student-visuals/messages.png'),
  chatbot: require('../../../assets/student-visuals/chatbot.png'),
} as const;

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

const dedupeByKey = <T,>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
  const route = useRoute<StudentHomeRoute>();
  const { state, logout, updatePreferences } = useAuth();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredVoice, setPreferredVoice] = useState<PreferredSpeechVoice>({});
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchListening, setSearchListening] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [unitSelectionSubmitting, setUnitSelectionSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Partial<Record<StudentSectionKey, number>>>({});
  const searchRecordingRef = useRef<Audio.Recording | null>(null);
  const searchSpeechDetectedRef = useRef(false);
  const searchLastSpeechMsRef = useRef<number | null>(null);
  const searchAutoStoppingRef = useRef(false);

  const markSectionOffset = useCallback(
    (section: StudentSectionKey, y: number) => {
      sectionOffsetsRef.current[section] = y;
    },
    [],
  );

  const scrollToSection = useCallback(
    (section: StudentSectionKey) => {
      const offset = sectionOffsetsRef.current[section];
      if (typeof offset !== 'number') {
        return;
      }
      scrollViewRef.current?.scrollTo({
        y: Math.max(offset - 16, 0),
        animated: true,
      });
    },
    [],
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) {
        return;
      }
      try {
        await speakWithFallback({
          text,
          speechRate: state.user?.speech_rate,
          preferredVoice,
          onStatusChange: setSpeechStatus,
          onError: (message) => {
            setSpeechStatus(preferredVoice.diagnosticMessage || message);
            Alert.alert('Voice error', message);
          },
        });
      } catch {
        setSpeechStatus(preferredVoice.diagnosticMessage || 'Voice failed. Check device TTS settings.');
        Alert.alert(
          'Voice error',
          preferredVoice.diagnosticMessage ||
            'Could not play speech on this device right now. Check device media volume and TTS settings.',
        );
      }
    },
    [preferredVoice, state.user?.speech_rate],
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
          payments,
          rewards,
          classCalls,
          classCommunities,
          offerings,
          curriculum,
        ] = await Promise.all([
          fetchStudentAssignments(state.accessToken),
          fetchStudentRegistrations(state.accessToken),
          fetchStudentTimetable(state.accessToken, profile.programme),
          fetchStudentFinanceStatuses(state.accessToken),
          fetchFinancePayments(state.accessToken).catch(() => []),
          fetchStudentRewards(state.accessToken, profile.id).catch(() => null),
          fetchClassCalls(state.accessToken, 'upcoming').catch(() => []),
          fetchClassCommunities(state.accessToken).catch(() => []),
          profile.programme
            ? fetchTermOfferings(state.accessToken, {
                programme: profile.programme,
                trimester: profile.trimester,
                offered: true,
              }).catch(() => [])
            : Promise.resolve([] as TermOfferingSummary[]),
          profile.programme
            ? fetchProgrammeCurriculum(state.accessToken, profile.programme).catch(() => [])
            : Promise.resolve([] as ProgrammeCurriculumUnit[]),
        ]);

        const latestFinance = [...financeStatuses].sort((a, b) => {
          const updatedDiff = parseMillis(b.updated_at) - parseMillis(a.updated_at);
          if (updatedDiff !== 0) {
            return updatedDiff;
          }
          if (a.academic_year !== b.academic_year) {
            return b.academic_year - a.academic_year;
          }
          return b.trimester - a.trimester;
        })[0] ?? null;
        const recentPayments = [...payments]
          .sort((a, b) => parseMillis(b.paid_at || b.created_at) - parseMillis(a.paid_at || a.created_at))
          .slice(0, 5);

        const now = Date.now();
        const activeUnitIds = new Set(
          registrations
            .filter((registration) =>
              ['submitted', 'pending_hod', 'approved'].includes(registration.status),
            )
            .map((registration) => registration.unit)
            .filter((unitId): unitId is number => typeof unitId === 'number'),
        );
        const upcomingClasses = dedupeByKey(
          [...timetable]
          .filter((item) => parseMillis(item.end_datetime) >= now - 60 * 60 * 1000)
            .filter(
              (item) =>
                activeUnitIds.size === 0 ||
                (typeof item.unit === 'number' && activeUnitIds.has(item.unit)),
            )
          .sort((a, b) => parseMillis(a.start_datetime) - parseMillis(b.start_datetime))
            .slice(0, 8),
          (item) => `${item.unit ?? 'unit'}-${item.start_datetime}-${item.room}`,
        ).slice(0, 4);

        const upcomingAssignments = dedupeByKey(
          [...assignments]
          .filter((item) => !!item.due_at)
          .sort((a, b) => parseMillis(a.due_at) - parseMillis(b.due_at))
            .slice(0, 8),
          (item) => String(item.id),
        ).slice(0, 4);

        const upcomingClassCalls = dedupeByKey(
          [...classCalls]
          .sort((a, b) => parseMillis(a.start_at) - parseMillis(b.start_at))
            .slice(0, 8),
          (item) => item.source_id || `${item.unit_id}-${item.start_at}`,
        ).slice(0, 4);

        const curriculumById = new Map<number, ProgrammeCurriculumUnit>(
          curriculum.map((item) => [item.id, item]),
        );
        const offeredUnitMeta: StudentOverview['offeredUnitMeta'] = {};
        const offeredUnits: ProgrammeCurriculumUnit[] = [];
        offerings
          .filter((item) => item.offered && item.unit)
          .forEach((offering) => {
            if (!offering.unit) {
              return;
            }
            const unit = curriculumById.get(offering.unit);
            if (!unit) {
              return;
            }
            offeredUnitMeta[unit.id] = {
              trimester: offering.trimester,
              academicYear: offering.academic_year,
            };
            if (!offeredUnits.find((candidate) => candidate.id === unit.id)) {
              offeredUnits.push(unit);
            }
          });

        setOverview({
          profile,
          assignments: upcomingAssignments,
          timetable: upcomingClasses,
          registrations,
          financeStatus: latestFinance,
          payments: recentPayments,
          rewards,
          classCalls: upcomingClassCalls,
          classCommunities: dedupeByKey(classCommunities, (item) => String(item.chatroom_id)).slice(0, 8),
          offeredUnits,
          offeredUnitMeta,
        });
        const offeredUnitIds = new Set(offeredUnits.map((unit) => unit.id));
        setSelectedUnitIds(
          registrations
            .filter(
              (registration) =>
                ['submitted', 'pending_hod', 'approved'].includes(registration.status) &&
                typeof registration.unit === 'number' &&
                (offeredUnitIds.size === 0 || offeredUnitIds.has(registration.unit)),
            )
            .map((registration) => registration.unit as number),
        );
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
    prepareSpeechPlayback();
  }, []);

  useEffect(() => {
    let active = true;
    const prepareTts = async () => {
      const voice = await loadPreferredSpeechVoice();
      if (!active) {
        return;
      }
      setPreferredVoice(voice);
      if (voice.hasUsableVoice === false && voice.diagnosticMessage) {
        setSpeechStatus(voice.diagnosticMessage);
      }
    };
    prepareTts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopSpeechPlayback();
      const activeRecording = searchRecordingRef.current;
      if (activeRecording) {
        activeRecording.stopAndUnloadAsync().catch(() => {
          // Ignore recorder cleanup failure on unmount.
        });
        searchRecordingRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const targetSection = route.params?.targetSection;
    if (!targetSection) {
      return;
    }
    const timer = setTimeout(() => {
      scrollToSection(targetSection);
    }, 180);
    return () => clearTimeout(timer);
  }, [overview, route.params?.targetSection, scrollToSection]);

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
    const paymentLine = overview.payments.length
      ? `Recent payments available: ${overview.payments.length}.`
      : 'No payment history is available yet.';
    const rewardsLine = overview.rewards
      ? `Rewards: ${overview.rewards.stars} stars earned with ${overview.rewards.history.length} merit records.`
      : `Current stars are ${overview.profile.stars}.`;
    return `${feeLine} ${paymentLine} ${rewardsLine}`;
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

  const unitSelectionSpeech = useMemo(() => {
    if (!overview) {
      return 'Unit registration is loading.';
    }
    if (!overview.offeredUnits.length) {
      return 'No units are currently open for selection.';
    }
    const names = overview.offeredUnits
      .slice(0, 5)
      .map((unit) => `${unit.code} ${unit.title}`)
      .join(', ');
    return `You can register up to ${MAX_UNIT_SELECTION} units this term. You currently have ${selectedUnitIds.length} selected. Available examples: ${names}.`;
  }, [overview, selectedUnitIds.length]);

  const visualNavigationCards = useMemo<VisualNavigatorCardProps[]>(
    () => [
      {
        id: 'classes',
        image: studentVisualAssets.classes,
        label: 'Classes',
        cue: 'See today',
        accentColor: '#3B82F6',
        onPress: () => navigation.navigate('StudentSchedule'),
      },
      {
        id: 'work',
        image: studentVisualAssets.assignments,
        label: 'Work',
        cue: 'Homework',
        accentColor: '#14B8A6',
        onPress: () => navigation.navigate('StudentAssignments'),
      },
      {
        id: 'groups',
        image: studentVisualAssets.groups,
        label: 'Groups',
        cue: 'Class chat',
        accentColor: '#8B5CF6',
        onPress: () => scrollToSection('class_communities'),
      },
      {
        id: 'money',
        image: studentVisualAssets.fees,
        label: 'Money',
        cue: 'Fees',
        accentColor: palette.success,
        onPress: () => scrollToSection('finance'),
      },
      {
        id: 'talk',
        image: studentVisualAssets.messages,
        label: 'Talk',
        cue: 'Messages',
        accentColor: '#F97316',
        onPress: () => scrollToSection('communication'),
      },
      {
        id: 'help',
        image: studentVisualAssets.chatbot,
        label: 'Help',
        cue: 'Chatbot',
        accentColor: '#EC4899',
        onPress: () => navigation.navigate('StudentChatbot'),
      },
    ],
    [navigation, scrollToSection],
  );

  const searchTargets = useMemo<SearchTarget[]>(() => {
    const targets: SearchTarget[] = [
      {
        id: 'upcoming-classes',
        title: 'Upcoming classes',
        subtitle: 'View timetable entries and upcoming class times.',
        keywords: ['timetable', 'schedule', 'upcoming classes', 'entries', 'calendar', 'class times'],
        onPress: () => navigation.navigate('StudentSchedule'),
      },
      {
        id: 'assignments',
        title: 'Assignments',
        subtitle: 'Review assignment deadlines and course work.',
        keywords: ['assignment', 'assignments', 'cat', 'deadline', 'course work', 'homework'],
        onPress: () => navigation.navigate('StudentAssignments'),
      },
      {
        id: 'finance-and-rewards',
        title: 'Finance and rewards',
        subtitle: 'Review fee status, payment history, and rewards information.',
        keywords: ['fees', 'fee', 'finance', 'payment', 'balance', 'wallet', 'rewards'],
        onPress: () => scrollToSection('finance'),
      },
      {
        id: 'unit-registration',
        title: 'Unit registration',
        subtitle: 'Register for offered units after finance clears your account.',
        keywords: ['courses', 'units', 'register', 'registration', 'course selection', 'unit selection'],
        onPress: () => scrollToSection('unit_registration'),
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
          scrollToSection('class_communities');
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
  }, [navigation, overview, scrollToSection]);

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

  const toggleUnitSelection = useCallback((unitId: number) => {
    setSelectedUnitIds((current) => {
      if (current.includes(unitId)) {
        setError(null);
        return current.filter((item) => item !== unitId);
      }
      if (current.length >= MAX_UNIT_SELECTION) {
        setError(`You can register a maximum of ${MAX_UNIT_SELECTION} units.`);
        setSpeechStatus(`You can only select ${MAX_UNIT_SELECTION} units.`);
        return current;
      }
      setError(null);
      return [...current, unitId];
    });
  }, []);

  const submitUnitSelectionAction = useCallback(async () => {
    if (!state.accessToken || !overview) {
      return;
    }
    if (!UNIT_SELECTION_ALLOWED_STATUSES.includes(overview.profile.current_status)) {
      setError('Finance team must clear your account before you can choose units.');
      return;
    }
    if (!selectedUnitIds.length) {
      setError('Select at least one unit before submitting.');
      return;
    }
    if (selectedUnitIds.length > MAX_UNIT_SELECTION) {
      setError(`You can register a maximum of ${MAX_UNIT_SELECTION} units.`);
      return;
    }
    setUnitSelectionSubmitting(true);
    setError(null);
    try {
      await submitStudentUnitSelection(state.accessToken, { unit_ids: selectedUnitIds });
      setSpeechStatus('Unit selection submitted for HOD approval.');
      await loadOverview(true);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError('Unable to submit unit selection.');
      }
    } finally {
      setUnitSelectionSubmitting(false);
    }
  }, [loadOverview, overview, selectedUnitIds, state.accessToken]);

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
        ref={scrollViewRef}
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
          <View style={styles.visualGuideCard}>
            <View style={styles.visualGuideIcon}>
              <MaterialCommunityIcons name="map-marker-path" size={34} color={palette.surface} />
            </View>
            <View style={styles.visualGuideTextWrap}>
              <Text style={styles.visualGuideTitle}>Tap a picture to move</Text>
              <Text style={styles.visualGuideBody}>
                Use the picture buttons below to find classes, work, fees, groups, messages, and help.
              </Text>
            </View>
          </View>
          <View style={styles.visualNavigatorGrid}>
            {visualNavigationCards.map((card) => (
              <VisualNavigatorCard
                key={card.id}
                image={card.image}
                label={card.label}
                cue={card.cue}
                accentColor={card.accentColor}
                onPress={card.onPress}
              />
            ))}
          </View>
        </View>

        <View style={styles.section} onLayout={(event) => markSectionOffset('search', event.nativeEvent.layout.y)}>
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
          <View style={styles.section} onLayout={(event) => markSectionOffset('overview', event.nativeEvent.layout.y)}>
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
                image={studentVisualAssets.classes}
                label="Calls"
                hint="Join class"
                accentColor={palette.primary}
                onPress={() => navigation.navigate('StudentClassCalls')}
              />
              <PictureActionCard
                image={studentVisualAssets.groups}
                label="Groups"
                hint="Open class chat"
                accentColor="#8B5CF6"
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
                image={studentVisualAssets.messages}
                label="Talk"
                hint="Open messages"
                accentColor="#F97316"
                onPress={() => navigation.navigate('MessageThreads', { role: 'student' })}
              />
              <PictureActionCard
                image={studentVisualAssets.chatbot}
                label="Help"
                hint="Ask chatbot"
                accentColor="#EC4899"
                onPress={() => navigation.navigate('StudentChatbot')}
              />
              <PictureActionCard
                image={studentVisualAssets.groups}
                label="Friends"
                hint="Private chats"
                accentColor="#14B8A6"
                onPress={() => navigation.navigate('StudentPeerDirectory')}
              />
            </View>
          </View>
        ) : null}

        {overview ? (
          <View
            style={styles.section}
            onLayout={(event) => markSectionOffset('unit_registration', event.nativeEvent.layout.y)}
          >
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

        {overview ? (
          <View style={styles.section}>
            <SectionHeader
              title="Unit registration"
              icon="book-education"
              onSpeak={() => speakText(unitSelectionSpeech)}
            />
            <DashboardTile
              icon={<MaterialCommunityIcons name="shield-check" size={26} color={palette.primary} />}
              title="Finance clearance"
              subtitle={
                overview.profile.current_status === 'finance_ok'
                  ? 'Cleared by finance. You can choose units below.'
                  : overview.profile.current_status === 'pending_hod'
                    ? 'Your current choices are pending HOD approval. You can still adjust and resubmit below.'
                  : overview.profile.current_status === 'active'
                    ? 'Active student. You can still review and update units for approval below.'
                    : `Current status: ${overview.profile.current_status}. Finance clearance is required first.`
              }
              disabled
            />
            <DashboardTile
              icon={<MaterialCommunityIcons name="format-list-checks" size={26} color={palette.secondary} />}
              title={`Selected ${selectedUnitIds.length} of ${MAX_UNIT_SELECTION} units`}
              subtitle="Your submitted choices appear in the records office and HOD approval queue."
              disabled
            />
            {overview.offeredUnits.length ? (
              overview.offeredUnits.map((unit) => {
                const selected = selectedUnitIds.includes(unit.id);
                const offeringMeta = overview.offeredUnitMeta[unit.id];
                return (
                  <DashboardTile
                    key={`offered-unit-${unit.id}`}
                    icon={
                      <MaterialCommunityIcons
                        name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                        size={26}
                        color={selected ? palette.success : palette.primary}
                      />
                    }
                    title={`${unit.code} - ${unit.title}`}
                    subtitle={`Credits ${unit.credit_hours} | Academic year ${offeringMeta?.academicYear ?? overview.profile.year} Trimester ${offeringMeta?.trimester ?? overview.profile.trimester}`}
                    onPress={
                      UNIT_SELECTION_ALLOWED_STATUSES.includes(overview.profile.current_status)
                        ? () => toggleUnitSelection(unit.id)
                        : undefined
                    }
                    disabled={!UNIT_SELECTION_ALLOWED_STATUSES.includes(overview.profile.current_status)}
                  />
                );
              })
            ) : (
              <DashboardTile
                icon={<MaterialCommunityIcons name="book-remove" size={26} color={palette.textSecondary} />}
                title="No offered units for this term"
                subtitle="The curriculum offering has not been published for your term yet."
                disabled
              />
            )}
            <VoiceButton
              label={
                unitSelectionSubmitting
                  ? 'Submitting unit choices...'
                  : `Submit ${selectedUnitIds.length} of ${MAX_UNIT_SELECTION} units`
              }
              onPress={
                UNIT_SELECTION_ALLOWED_STATUSES.includes(overview.profile.current_status) &&
                overview.offeredUnits.length
                  ? submitUnitSelectionAction
                  : undefined
              }
              isActive={unitSelectionSubmitting}
            />
            <Text style={styles.helper}>
              After submission, records can review the entry and HOD approval will activate your registered classes and class communities.
            </Text>
          </View>
        ) : null}

        <View style={styles.section} onLayout={(event) => markSectionOffset('timetable', event.nativeEvent.layout.y)}>
          <SectionHeader title="Upcoming classes" icon="calendar-clock" onSpeak={() => speakText(classesSpeech)} />
          {overview?.timetable.length ? (
            overview.timetable.map((entry, index) => (
              <DashboardTile
                key={`timetable-${entry.id}-${index}`}
                icon={<MaterialCommunityIcons name="book-open-variant" size={26} color={palette.primary} />}
                title={`${entry.unit_code ?? `Unit ${entry.unit ?? 'N/A'}`}`}
                subtitle={`${formatDateTime(entry.start_datetime)}  |  Room ${entry.room}`}
                onPress={() => navigation.navigate('StudentSchedule')}
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="calendar-remove" size={26} color={palette.textSecondary} />}
              title="No upcoming timetable entries"
              subtitle="Timetable will appear here once your programme schedule is published."
              onPress={() => navigation.navigate('StudentSchedule')}
            />
          )}
        </View>

        <View style={styles.section} onLayout={(event) => markSectionOffset('assignments', event.nativeEvent.layout.y)}>
          <SectionHeader title="Assignments" icon="clipboard-text-clock" onSpeak={() => speakText(assignmentsSpeech)} />
          {overview?.assignments.length ? (
            overview.assignments.map((assignment, index) => (
              <DashboardTile
                key={`assignment-${assignment.id}-${index}`}
                icon={<MaterialCommunityIcons name="clipboard-check" size={26} color={palette.secondary} />}
                title={assignment.title}
                subtitle={`${assignment.unit_code ?? ''} ${assignment.unit_title}  |  Due ${formatDateTime(assignment.due_at)}`}
                onPress={() => navigation.navigate('StudentAssignments')}
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="clipboard-remove" size={26} color={palette.textSecondary} />}
              title="No assignments due"
              subtitle="Your upcoming assignments will show here."
              onPress={() => navigation.navigate('StudentAssignments')}
            />
          )}
        </View>

        <View style={styles.section} onLayout={(event) => markSectionOffset('class_calls', event.nativeEvent.layout.y)}>
          <SectionHeader title="Class calls" icon="video-wireless" onSpeak={() => speakText(callsSpeech)} />
          {overview?.classCalls.length ? (
            overview.classCalls.map((call, index) => (
              <DashboardTile
                key={`class-call-${call.id}-${index}`}
                icon={<MaterialCommunityIcons name="video" size={26} color={palette.primary} />}
                title={`${call.unit_code} live class`}
                subtitle={`${formatDateTime(call.start_at)} | Tap to join`}
                onPress={() => navigation.navigate('StudentClassCalls')}
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="video-off" size={26} color={palette.textSecondary} />}
              title="No upcoming class calls"
              subtitle="When your lecturer schedules a call, it will appear here."
              onPress={() => navigation.navigate('StudentClassCalls')}
            />
          )}
        </View>

        <View
          style={styles.section}
          onLayout={(event) => markSectionOffset('class_communities', event.nativeEvent.layout.y)}
        >
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

        <View style={styles.section} onLayout={(event) => markSectionOffset('finance', event.nativeEvent.layout.y)}>
          <SectionHeader title="Finance and rewards" icon="wallet" onSpeak={() => speakText(financeSpeech)} />
          <DashboardTile
            icon={<MaterialCommunityIcons name="cash-check" size={26} color={palette.success} />}
            title="Fee status"
            subtitle={
              overview?.financeStatus
                ? `Paid ${formatMoney(overview.financeStatus.total_paid)} of ${formatMoney(overview.financeStatus.total_due)} | ${overview.financeStatus.clearance_status.replace(/_/g, ' ')}`
                : 'No finance records found yet.'
            }
            disabled
          />
          {overview?.payments.length ? (
            overview.payments.map((payment, index) => (
              <DashboardTile
                key={`student-payment-${payment.id}-${index}`}
                icon={<MaterialCommunityIcons name="receipt-text-check" size={26} color={palette.primary} />}
                title={`${formatMoney(payment.amount)} via ${payment.method || 'Recorded payment'}`}
                subtitle={`${payment.ref || 'No receipt reference'} | ${formatDateTime(payment.paid_at || payment.created_at)}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              icon={<MaterialCommunityIcons name="receipt-text-remove" size={26} color={palette.textSecondary} />}
              title="No payment history yet"
              subtitle="Payments recorded by finance will appear here."
              disabled
            />
          )}
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

        <View
          style={styles.section}
          onLayout={(event) => markSectionOffset('communication', event.nativeEvent.layout.y)}
        >
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
              speakText(
                'Voice test successful. If you do not hear this, turn on Android text to speech and raise media volume.',
              ),
          },
          { label: 'Stop voice', onPress: () => stopSpeechPlayback() },
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
  visualGuideCard: {
    backgroundColor: '#0F2557',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  visualGuideIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualGuideTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  visualGuideTitle: {
    ...typography.headingM,
    color: palette.surface,
  },
  visualGuideBody: {
    ...typography.helper,
    color: '#D7E3FF',
  },
  visualNavigatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  visualNavigatorCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E6ECF8',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 140,
  },
  visualNavigatorImage: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  visualNavigatorAsset: {
    width: 62,
    height: 62,
  },
  visualNavigatorLabel: {
    ...typography.headingM,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  visualNavigatorCue: {
    ...typography.helper,
    color: palette.textSecondary,
    textAlign: 'center',
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
    minHeight: 132,
  },
  pictureCardImage: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pictureCardAsset: {
    width: 58,
    height: 58,
  },
  pictureCardLabel: {
    ...typography.headingM,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  pictureCardHint: {
    ...typography.helper,
    color: palette.textSecondary,
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
