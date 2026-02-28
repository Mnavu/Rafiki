import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { GreetingHeader, VoiceButton, RoleBadge } from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';

type LoginRoute = RouteProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const route = useRoute<LoginRoute>();
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const result = await login({
      username: username.trim(),
      password,
      expectedRole: route.params.role,
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
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <VoiceButton
          label={loading ? 'Signing in...' : 'Sign in'}
          onPress={handleLogin}
          isActive={!!username && !!password}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
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
  error: {
    ...typography.helper,
    color: palette.danger,
  },
});
