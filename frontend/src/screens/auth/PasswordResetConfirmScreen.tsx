import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Text, Alert, TouchableOpacity } from 'react-native';
import { VoiceButton } from '@components/index';
import { Ionicons } from '@expo/vector-icons';
import { confirmPasswordReset } from '@services/api';
import { palette, spacing, typography } from '@theme/index';
import { useNavigation } from '@react-navigation/native';

export const PasswordResetConfirmScreen: React.FC = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!username || !token || !password) {
      Alert.alert('Missing details', 'Fill username, token, and new password.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    try {
      setSubmitting(true);
      await confirmPasswordReset({ username, token, new_password: password });
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Reset failed', error?.message ?? 'Check the token and try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm password reset</Text>
      <Text style={styles.body}>
        Enter the username, token, and a new password supplied by the administrator.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
      />
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.inputFlex]}
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((prev) => !prev)}
          style={styles.eyeButton}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={showPassword ? 'eye' : 'eye-off'}
            size={24}
            color={palette.textSecondary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.inputFlex]}
          placeholder="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity
          onPress={() => setShowConfirm((prev) => !prev)}
          style={styles.eyeButton}
          accessibilityRole="button"
          accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={showConfirm ? 'eye' : 'eye-off'}
            size={24}
            color={palette.textSecondary}
          />
        </TouchableOpacity>
      </View>
      <VoiceButton
        label={submitting ? 'Saving...' : 'Save password'}
        onPress={handleSubmit}
        accessibilityHint="Submit reset token"
      />
      <VoiceButton label="Back" onPress={() => navigation.goBack()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    ...typography.headingXL,
    color: palette.textPrimary,
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
  },
  input: {
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.disabled,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
  },
  eyeButton: {
    paddingHorizontal: spacing.md,
  },
});
