import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { AppMenu, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { Role } from '@app-types/roles';
import { palette, radius, spacing, typography } from '@theme/index';

type VideoRoomRoute = RouteProp<RootStackParamList, 'VideoRoom'>;
type VideoRoomNavigation = NativeStackNavigationProp<RootStackParamList>;

export const VideoRoomScreen: React.FC = () => {
  const route = useRoute<VideoRoomRoute>();
  const navigation = useNavigation<VideoRoomNavigation>();
  const { state, logout, updatePreferences } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { meetingUrl, title } = route.params;
  const roleBadge: Role = state.user?.role ?? 'lecturer';

  const openExternal = async () => {
    try {
      await Linking.openURL(meetingUrl);
    } catch (openError) {
      if (openError instanceof Error) {
        setError(openError.message);
      } else {
        setError('Unable to open the video room link.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <GreetingHeader
          name={title || 'Video class room'}
          greeting="Embedded class call"
          rightAccessory={<RoleBadge role={roleBadge} />}
        />
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Video room error</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : null}

      {meetingUrl ? (
        <View style={styles.webviewWrap}>
          {loading ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={styles.helper}>Joining video room...</Text>
            </View>
          ) : null}
          <WebView
            source={{ uri: meetingUrl }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            startInLoadingState
            onLoadEnd={() => setLoading(false)}
            onError={(event: any) => {
              setLoading(false);
              setError(event.nativeEvent.description || 'Unable to load embedded room.');
            }}
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.errorTitle}>No meeting URL was provided.</Text>
        </View>
      )}

      <AppMenu
        actions={[
          ...(state.user?.role === 'student'
            ? [{ label: 'Help chatbot', onPress: () => navigation.navigate('StudentChatbot') }]
            : []),
          { label: 'Open external', onPress: openExternal },
          { label: 'Back', onPress: () => navigation.goBack() },
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  webviewWrap: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: palette.surface,
  },
  webview: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  errorCard: {
    marginHorizontal: spacing.lg,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
});
