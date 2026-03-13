import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  createClassCommunityMessage,
  fetchClassCommunityMessages,
  type ClassCommunityMessage,
} from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type CommunityRoute = RouteProp<RootStackParamList, 'ClassCommunityDetail'>;
type CommunityNav = NativeStackNavigationProp<RootStackParamList>;

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'No time';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No time';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const ClassCommunityDetailScreen: React.FC = () => {
  const route = useRoute<CommunityRoute>();
  const navigation = useNavigation<CommunityNav>();
  const { state, logout, updatePreferences } = useAuth();

  const [messages, setMessages] = useState<ClassCommunityMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(
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
        const payload = await fetchClassCommunityMessages(state.accessToken, route.params.chatroomId);
        setMessages(payload.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
      } catch (loadError) {
        if (loadError instanceof Error) {
          setError(loadError.message);
        } else {
          setError('Unable to load class community messages.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [route.params.chatroomId, state.accessToken],
  );

  useEffect(() => {
    loadMessages(false);
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!state.accessToken) {
      return;
    }
    const body = draft.trim();
    if (!body) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createClassCommunityMessage(state.accessToken, {
        chatroom: route.params.chatroomId,
        message: body,
      });
      setDraft('');
      await loadMessages(true);
    } catch (sendError) {
      if (sendError instanceof Error) {
        setError(sendError.message);
      } else {
        setError('Unable to send class community message.');
      }
    } finally {
      setSending(false);
    }
  };

  const roleBadge = useMemo(() => {
    if (state.user?.role === 'parent') {
      return 'parent';
    }
    if (state.user?.role === 'lecturer') {
      return 'lecturer';
    }
    return 'student';
  }, [state.user?.role]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading class community...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMessages(true)} />}
      >
        <GreetingHeader
          name={route.params.unitTitle}
          greeting="Class community"
          rightAccessory={<RoleBadge role={roleBadge} />}
        />

        {route.params.meetingUrl ? (
          <DashboardTile
            title="Join class call"
            subtitle="Tap to open the latest call room for this class."
            onPress={() =>
              navigation.navigate('VideoRoom', {
                meetingUrl: route.params.meetingUrl!,
                title: route.params.unitTitle,
              })
            }
          />
        ) : null}

        {state.user?.role === 'student' ? (
          <DashboardTile
            title="Need help? Open chatbot"
            subtitle="Ask the student assistant about this class schedule or coursework."
            onPress={() => navigation.navigate('StudentChatbot')}
          />
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Class community error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messages</Text>
          {messages.length ? (
            messages.map((item, index) => (
              <DashboardTile
                key={`community-message-${item.id}-${index}`}
                title={item.author_detail?.display_name || item.author_detail?.username || 'Participant'}
                subtitle={`${item.message} | ${formatDateTime(item.created_at)}`}
                disabled
              />
            ))
          ) : (
            <DashboardTile
              title="No group messages yet"
              subtitle="Start the class conversation with a short text."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type message to class group"
          placeholderTextColor={palette.textSecondary}
          multiline
        />
        <VoiceButton
          label={sending ? 'Sending...' : 'Send to class'}
          onPress={sendMessage}
          size="compact"
        />
      </View>
      <AppMenu
        actions={[
          ...(state.user?.role === 'student'
            ? [{ label: 'Help chatbot', onPress: () => navigation.navigate('StudentChatbot') }]
            : []),
          { label: 'Refresh', onPress: () => loadMessages(true) },
          { label: 'Back', onPress: () => navigation.goBack() },
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
    gap: spacing.sm,
    backgroundColor: palette.background,
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.textPrimary,
    backgroundColor: palette.surface,
  },
});
