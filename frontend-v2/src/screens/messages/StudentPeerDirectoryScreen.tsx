import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  createStudentPeerThread,
  fetchCommunicationThreads,
  fetchStudentPeers,
  type CommunicationThread,
  type StudentPeerSummary,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type StudentPeerNavigation = NativeStackNavigationProp<RootStackParamList>;

const getExistingThread = (
  threads: CommunicationThread[],
  selfId: number,
  peerId: number,
): CommunicationThread | null =>
  threads.find(
    (thread) =>
      ((thread.student === selfId && thread.teacher === peerId) ||
        (thread.student === peerId && thread.teacher === selfId)) &&
      !thread.parent,
  ) ?? null;

export const StudentPeerDirectoryScreen: React.FC = () => {
  const navigation = useNavigation<StudentPeerNavigation>();
  const { state, logout, updatePreferences } = useAuth();
  const [peers, setPeers] = useState<StudentPeerSummary[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingPeerId, setCreatingPeerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPeers = useCallback(
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
        const [peerRows, threadRows] = await Promise.all([
          fetchStudentPeers(state.accessToken),
          fetchCommunicationThreads(state.accessToken).catch(() => []),
        ]);
        setPeers(
          [...peerRows].sort((left, right) =>
            left.display_name.localeCompare(right.display_name),
          ),
        );
        setThreads(threadRows);
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load class peers.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadPeers(false);
  }, [loadPeers]);

  const myName = useMemo(
    () => state.user?.display_name?.trim() || state.user?.username || 'Student',
    [state.user],
  );

  const openPeerThread = async (peer: StudentPeerSummary) => {
    if (!state.accessToken || !state.user || creatingPeerId) {
      return;
    }
    const existing = getExistingThread(threads, state.user.id, peer.user_id);
    if (existing) {
      navigation.navigate('MessageThreadDetail', {
        role: 'student',
        threadId: existing.id,
        threadTitle: `${peer.display_name} - Student Year ${peer.year}`,
      });
      return;
    }
    setCreatingPeerId(peer.user_id);
    setError(null);
    try {
      const thread = await createStudentPeerThread(state.accessToken, peer.user_id);
      navigation.navigate('MessageThreadDetail', {
        role: 'student',
        threadId: thread.id,
        threadTitle: `${peer.display_name} - Student Year ${peer.year}`,
      });
    } catch (createError) {
      if (createError instanceof Error) {
        setError(createError.message);
      } else {
        setError('Unable to open peer chat.');
      }
    } finally {
      setCreatingPeerId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading peer directory...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPeers(true)} />}
      >
        <GreetingHeader
          name={myName}
          greeting="Student peer chats"
          rightAccessory={<RoleBadge role="student" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Peer chat setup error</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <VoiceButton label="Retry" onPress={() => loadPeers(true)} />
          </View>
        ) : null}

        <View style={styles.section}>
          <DashboardTile
            title="Need help? Open chatbot"
            subtitle="Ask class timing or course questions from the student assistant."
            onPress={() => navigation.navigate('StudentChatbot')}
          />
          <Text style={styles.sectionTitle}>Class peers</Text>
          {peers.length ? (
            peers.map((peer, index) => {
              const existing = state.user
                ? getExistingThread(threads, state.user.id, peer.user_id)
                : null;
              return (
                <DashboardTile
                  key={`peer-${peer.user_id}-${index}`}
                  title={`${peer.display_name} - Student Year ${peer.year}`}
                  subtitle={`${peer.shared_units.join(', ')}  |  ${existing ? 'Existing thread' : 'Tap to start private 1:1 chat'}`}
                  onPress={() => openPeerThread(peer)}
                  disabled={creatingPeerId === peer.user_id}
                />
              );
            })
          ) : (
            <DashboardTile
              title="No classmates available yet"
              subtitle="Private peer messaging unlocks when students share approved classes."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Help chatbot', onPress: () => navigation.navigate('StudentChatbot') },
          { label: 'Refresh peers', onPress: () => loadPeers(true) },
          { label: 'Back to threads', onPress: () => navigation.goBack() },
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
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
