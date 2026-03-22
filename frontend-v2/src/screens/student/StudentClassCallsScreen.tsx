import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, DashboardTile, GreetingHeader, RoleBadge } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { fetchClassCalls, type ClassCallSummary } from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

export const StudentClassCallsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { state, logout, updatePreferences } = useAuth();
  const [calls, setCalls] = useState<ClassCallSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = useCallback(
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
        const rows = await fetchClassCalls(state.accessToken, 'upcoming');
        setCalls(
          [...rows].sort(
            (left, right) => Date.parse(left.start_at ?? '') - Date.parse(right.start_at ?? ''),
          ),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load class calls.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.accessToken],
  );

  useEffect(() => {
    loadCalls(false);
  }, [loadCalls]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.helper}>Loading class calls...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadCalls(true)} />}
      >
        <GreetingHeader
          name={state.user?.display_name?.trim() || state.user?.username || 'Student'}
          greeting="Class calls"
          rightAccessory={<RoleBadge role="student" />}
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Class call error</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming online classes</Text>
          {calls.length ? (
            calls.map((call) => (
              <DashboardTile
                key={`student-call-${call.id}`}
                icon={<MaterialCommunityIcons name="video-wireless" size={26} color={palette.primary} />}
                title={`${call.unit_code} live class`}
                subtitle={`${formatDateTime(call.start_at)} | ${call.unit_title}`}
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
              title="No class calls yet"
              subtitle="Your lecturer has not scheduled the next online class yet."
              disabled
            />
          )}
        </View>
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Refresh', onPress: () => loadCalls(true) },
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: spacing.md,
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
});
