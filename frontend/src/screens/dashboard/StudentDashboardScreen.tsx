import React, { useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  AlertBanner,
  VoiceButton,
  FloatingAssistantButton,
  BottomUtilityBar,
  NotificationBell,
  VoiceSearchBar,
  ChatWidget,
} from '@components/index';
import { palette, spacing } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { usePullToRefresh } from '@hooks/usePullToRefresh';

type StudentTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const studentTiles: StudentTile[] = [
  {
    key: 'timetable',
    title: 'My Timetable',
    subtitle: "See today's classes and reminders.",
    icon: 'calendar',
    navigateTo: 'StudentTimetable',
  },
  {
    key: 'assignments',
    title: 'Assignments',
    subtitle: 'Check due work and submit easily.',
    icon: 'clipboard',
    navigateTo: 'StudentAssignments',
  },
  {
    key: 'communicate',
    title: 'Communicate',
    subtitle: 'Call, voice note, or message teachers.',
    icon: 'call',
    navigateTo: 'StudentCommunicate',
  },
  {
    key: 'help',
    title: 'Help',
    subtitle: 'Ask EduAssist or contact an advisor.',
    icon: 'help-buoy',
    navigateTo: 'StudentHelp',
  },
  {
    key: 'library',
    title: 'Library',
    subtitle: 'Open picture-heavy resources.',
    icon: 'book',
    navigateTo: 'StudentLibrary',
  },
  {
    key: 'rewards',
    title: 'Rewards Hub',
    subtitle: 'Claim merch & fee credits.',
    icon: 'gift',
    navigateTo: 'Rewards',
  },
];

export const StudentDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [showAssistant, setShowAssistant] = useState(false);
  const { state } = useAuth();

  const studentName =
    state.user?.display_name?.trim() || state.user?.username || 'Student';

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
        <GreetingHeader name={studentName} rightAccessory={<NotificationBell />} />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        <AlertBanner message="Math class starts in 15 minutes" variant="warning" />
        <View style={styles.tiles}>
          {studentTiles.map((tile) => (
            <DashboardTile
              key={tile.key}
              title={tile.title}
              subtitle={tile.subtitle}
              style={styles.tile}
              onPress={() => navigation.navigate(tile.navigateTo as never)}
              icon={<Ionicons name={tile.icon as any} size={28} color={palette.primary} />}
            />
          ))}
        </View>
      </ScrollView>
      <VoiceButton
        label="Speak timetable"
        onPress={() => navigation.navigate('StudentTimetable')}
        accessibilityHint="Reads today's classes"
      />
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
    paddingBottom: 160,
    gap: spacing.lg,
  },
  tiles: {
    gap: spacing.md,
  },
  tile: {
    minHeight: 120,
  },
});


