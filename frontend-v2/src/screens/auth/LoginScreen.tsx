import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { GreetingHeader, VoiceButton, RoleBadge } from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';

type LoginRoute = RouteProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const route = useRoute<LoginRoute>();
  const { login, loading, getSavedCredentials, getRecentCredentials } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [recent, setRecent] = useState<Array<{ username: string; password: string }>>([]);

  useEffect(() => {
    let mounted = true;
    const hydrateSaved = async () => {
      const saved = await getSavedCredentials(route.params.role);
      if (!mounted) {
        return;
      }
      if (saved) {
        setUsername(saved.username);
        setPassword(saved.password);
      }
      const recentByRole = await getRecentCredentials(route.params.role);
      if (recentByRole.length) {
        setRecent(
          recentByRole.map((item) => ({
            username: item.username,
            password: item.password,
          })),
        );
      }
      setCredentialsLoaded(true);
    };
    hydrateSaved();
    return () => {
      mounted = false;
    };
  }, [getRecentCredentials, getSavedCredentials, route.params.role]);

  const handleLogin = async () => {
    setError(null);
    const result = await login({
      username: username.trim(),
      password,
      roleHint: route.params.role,
    });
    if (!result.success) {
      setError(result.error ?? 'Unable to sign in');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GreetingHeader
          name="Welcome back"
          greeting="Sign in to continue"
          rightAccessory={<RoleBadge role={route.params.role} />}
        />
        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. student1"
          />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="********"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              style={styles.passwordToggle}
              onPress={() => setShowPassword((current) => !current)}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {credentialsLoaded
              ? 'Saved credentials are filled automatically for this role after successful login.'
              : 'Loading saved credentials...'}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {recent.length ? (
            <View style={styles.savedList}>
              <Text style={styles.label}>Saved accounts for this role</Text>
              {recent.slice(0, 4).map((item, index) => (
                <TouchableOpacity
                  key={`${item.username}-${index}`}
                  style={styles.savedItem}
                  onPress={() => {
                    setUsername(item.username);
                    setPassword(item.password);
                  }}
                >
                  <Text style={styles.savedText}>{item.username}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <VoiceButton
            label={loading ? 'Signing in...' : 'Sign in'}
            onPress={handleLogin}
            isActive={!!username && !!password}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  label: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.disabled,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: palette.textPrimary,
  },
  passwordToggle: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  error: {
    ...typography.helper,
    color: palette.danger,
  },
  savedList: {
    gap: spacing.xs,
  },
  savedItem: {
    borderWidth: 1,
    borderColor: palette.disabled,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surface,
  },
  savedText: {
    ...typography.helper,
    color: palette.textPrimary,
  },
});
