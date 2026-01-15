import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TextInput, Text, Alert, TouchableOpacity } from 'react-native';
import { VoiceButton } from '@components/index';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { useAuth } from '@context/AuthContext';
import { changePasswordSelf } from '@services/api';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useNavigation } from '@react-navigation/native';

export const ForcePasswordChangeScreen: React.FC = () => {
  const { state, markPasswordUpdated, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const user = state.user;
  const roleName = useMemo(() => user?.role.toUpperCase() ?? '', [user?.role]);

  useEffect(() => {
    if (user && !user.must_change_password) {
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard', params: { role: user.role } }] });
    }
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: 'RoleSelection' }] });
    }
  }, [navigation, user]);

  const handleSubmit = async () => {
    if (!user || !state.accessToken) {
      Alert.alert('Session expired', 'Please sign in again.');
      await logout();
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    try {
      setSubmitting(true);
      await changePasswordSelf(password, state.accessToken);
      markPasswordUpdated();
      Alert.alert('Updated', 'Password changed successfully.');
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.body}>
        {roleName} account {user.username} must choose a new password before continuing.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.inputFlex]}
          placeholder="New password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
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
          secureTextEntry={!showConfirm}
          value={confirm}
          onChangeText={setConfirm}
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
        accessibilityHint="Set new password"
      />
      <VoiceButton label="Logout" onPress={logout} accessibilityHint="Sign out" />
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
