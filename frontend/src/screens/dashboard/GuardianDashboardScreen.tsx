import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Text,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  AlertBanner,
  FloatingAssistantButton,
  BottomUtilityBar,
  VoiceButton,
  NotificationBell,
  VoiceSearchBar,
  ChatWidget,
} from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { usePullToRefresh } from '@hooks/usePullToRefresh';
import { useAuth } from '@context/AuthContext';
import { fetchGuardianLinks, type ApiGuardianLink } from '@services/api';

const progressBars = [
  { subject: 'Math', color: palette.success, value: 85 },
  { subject: 'Science', color: palette.warning, value: 72 },
  { subject: 'English', color: palette.danger, value: 58 },
];

type GuardianTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const GuardianTiles: GuardianTile[] = [
  {
    key: 'progress',
    title: 'Progress',
    subtitle: 'Color bars and attendance toggles.',
    icon: 'ribbon',
    navigateTo: 'GuardianProgress',
  },
  {
    key: 'fees',
    title: 'Fees',
    subtitle: 'Balances, plans, and quick payments.',
    icon: 'cash',
    navigateTo: 'GuardianFees',
  },
  {
    key: 'messages',
    title: 'Messages',
    subtitle: 'Threads with teachers and admin.',
    icon: 'chatbubble',
    navigateTo: 'GuardianMessages',
  },
  {
    key: 'timetable',
    title: 'Timetable',
    subtitle: 'Listen to today or plan the week.',
    icon: 'time',
    navigateTo: 'GuardianTimetable',
  },
  {
    key: 'announcements',
    title: 'Announcements',
    subtitle: 'School notices with audio playback.',
    icon: 'megaphone',
    navigateTo: 'GuardianAnnouncements',
  },
  {
    key: 'rewards',
    title: 'Rewards Hub',
    subtitle: "See your student's perks.",
    icon: 'gift',
    navigateTo: 'Rewards',
  },
];

export const GuardianDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [showAssistant, setShowAssistant] = useState(false);
  const { state } = useAuth();
  const [links, setLinks] = useState<ApiGuardianLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    if (state.user?.role !== 'Guardian' || !state.accessToken) {
      return;
    }
    try {
      setLoadingLinks(true);
      const data = await fetchGuardianLinks(state.accessToken);
      setLinks(data);
      setLinkError(null);
    } catch (error: any) {
      console.warn('Failed to load Guardian links', error);
      setLinkError(error?.message ?? 'Unable to load linked students.');
    } finally {
      setLoadingLinks(false);
    }
  }, [state.accessToken, state.user?.role]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const GuardianName = state.user?.display_name?.trim() || state.user?.username || 'Guardian';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
      >
        <GreetingHeader name={GuardianName} rightAccessory={<NotificationBell />} />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        {state.user?.role === 'Guardian' ? (
          <View style={styles.childCard}>
            <Text style={styles.childCardTitle}>Student on file</Text>
            {loadingLinks ? (
              <ActivityIndicator color={palette.primary} />
            ) : linkError ? (
              <Text style={styles.helperText}>{linkError}</Text>
            ) : links.length ? (
              links.map((link) => (
                <View key={link.id} style={styles.childRow}>
                  <Text style={styles.childName}>
                    {link.student_detail.display_name || link.student_detail.username}
                  </Text>
                  <Text style={styles.childMeta}>
                    Relationship: {link.relationship || 'Not specified'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.helperText}>
                No student is linked yet. Ask Records to connect your child.
              </Text>
            )}
          </View>
        ) : null}
        <AlertBanner message="KES 12,000 due in 5 days" variant="warning" />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress Overview</Text>
          {progressBars.map((bar) => (
            <View key={bar.subject} style={styles.progressRow}>
              <Text style={styles.progressLabel}>{bar.subject}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${bar.value}%`, backgroundColor: bar.color },
                  ]}
                />
              </View>
              <Text style={styles.progressValue}>{bar.value}%</Text>
            </View>
          ))}
        </View>
        {GuardianTiles.map((tile) => (
          <DashboardTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={<Ionicons name={tile.icon as any} size={28} color={palette.primary} />}
            onPress={() => navigation.navigate(tile.navigateTo as never)}
          />
        ))}
      </ScrollView>
      <VoiceButton label="Speak summary" onPress={() => navigation.navigate('GuardianProgress')} />
      <FloatingAssistantButton label="Chat" onPress={() => setShowAssistant(true)} />
      <BottomUtilityBar
        items={[
          { label: 'Home', isActive: true },
          { label: 'Rewards', onPress: () => navigation.navigate('Rewards') },
          { label: 'Search', onPress: () => navigation.navigate('Search') },
          { label: 'Profile', onPress: () => navigation.navigate('Profile') },
        ]}
      />
      {showAssistant ? <ChatWidget onClose={() => setShowAssistant(false)} /> : null}
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
    paddingBottom: 180,
    gap: spacing.lg,
  },
  childCard: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: 24,
    gap: spacing.sm,
  },
  childCardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  childRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.disabled,
  },
  childName: {
    ...typography.body,
    color: palette.textPrimary,
  },
  childMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  helperText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  section: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: 24,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressLabel: {
    flex: 1,
    ...typography.body,
    color: palette.textPrimary,
  },
  progressTrack: {
    flex: 3,
    height: 20,
    borderRadius: 12,
    backgroundColor: palette.disabled,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 12,
  },
  progressValue: {
    width: 48,
    textAlign: 'right',
    ...typography.helper,
  },
});

