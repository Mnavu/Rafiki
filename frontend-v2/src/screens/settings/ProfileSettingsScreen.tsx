import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppMenu, GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { updateMyProfile } from '@services/api';
import { palette, radius, spacing, typography } from '@theme/index';

type ProfileNav = NativeStackNavigationProp<RootStackParamList>;

export const ProfileSettingsScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNav>();
  const { state, applyProfileUpdate, updatePreferences, logout } = useAuth();
  const [username, setUsername] = useState(state.user?.username ?? '');
  const [displayName, setDisplayName] = useState(state.user?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setUsername(state.user?.username ?? '');
    setDisplayName(state.user?.display_name ?? '');
  }, [state.user?.username, state.user?.display_name]);

  const canSave = useMemo(() => {
    const currentUsername = (state.user?.username ?? '').trim().toLowerCase();
    const nextUsername = username.trim().toLowerCase();
    const currentDisplay = (state.user?.display_name ?? '').trim();
    const nextDisplay = displayName.trim();
    return (
      !!nextUsername && (currentUsername !== nextUsername || currentDisplay !== nextDisplay)
    );
  }, [displayName, state.user?.display_name, state.user?.username, username]);

  const saveProfile = async () => {
    if (!state.accessToken || !state.user) {
      return;
    }
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const previousUsername = state.user.username;
      const updated = await updateMyProfile(state.accessToken, {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
      });
      await applyProfileUpdate(updated, previousUsername);
      setSuccess('Profile updated. New username is active across the app.');
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Could not update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!state.user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GreetingHeader
          name={state.user.display_name?.trim() || state.user.username}
          greeting="Account settings"
          rightAccessory={<RoleBadge role={state.user.role} />}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <Text style={styles.helper}>
            Change username and display name. Username must be unique.
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={palette.textSecondary}
            autoCapitalize="none"
          />
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            placeholder="Display name (shown to others)"
            placeholderTextColor={palette.textSecondary}
          />
          <VoiceButton
            label={saving ? 'Saving profile...' : 'Save profile'}
            onPress={canSave && !saving ? saveProfile : undefined}
            isActive={saving}
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Update failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Saved</Text>
            <Text style={styles.successBody}>{success}</Text>
          </View>
        ) : null}
      </ScrollView>

      <AppMenu
        actions={[
          { label: 'Back', onPress: () => navigation.goBack() },
          { label: 'Log out', onPress: logout },
        ]}
        simpleMode={state.user.prefers_simple_language !== false}
        highContrast={state.user.prefers_high_contrast === true}
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
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.md,
    padding: spacing.md,
    color: palette.textPrimary,
    backgroundColor: palette.background,
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
  successCard: {
    backgroundColor: '#E3F9E5',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  successTitle: {
    ...typography.headingM,
    color: '#146C2E',
  },
  successBody: {
    ...typography.helper,
    color: '#146C2E',
  },
});

