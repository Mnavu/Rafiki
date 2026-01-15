import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Alert, Linking } from 'react-native';
import { useAuth } from '@context/AuthContext';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';

export const ProfileScreen: React.FC = () => {
  const { state, logout, getTotpSetup, activateTotp, disableTotp } = useAuth();
  const user = state.user;
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState<'setup' | 'activate' | 'disable' | null>(null);

  const handleFetchTotp = async () => {
    try {
      setBusy('setup');
      const data = await getTotpSetup();
      setTotpSecret(data.secret);
      if (data.otpauth_url) {
        try {
          const canOpen = await Linking.canOpenURL(data.otpauth_url);
          if (canOpen) {
            Linking.openURL(data.otpauth_url);
          }
        } catch (error) {
          console.warn('Unable to open authenticator link', error);
        }
      }
      Alert.alert(
        'Authenticator setup',
        'Scan the QR launched in your authenticator app. If it did not open, add this manual code:\n\n' +
          data.secret,
      );
    } catch (error: any) {
      Alert.alert('Authenticator', error?.message ?? 'Unable to generate setup code.');
    } finally {
      setBusy(null);
    }
  };

  const handleActivate = async () => {
    if (!totpCode) {
      Alert.alert(
        'Authenticator',
        'Enter the 6-digit code from your authenticator to enable security.',
      );
      return;
    }
    try {
      setBusy('activate');
      await activateTotp(totpCode);
      setTotpCode('');
      Alert.alert('Authenticator', 'Two-factor authentication is now enabled.');
    } catch (error: any) {
      Alert.alert('Authenticator', error?.message ?? 'Invalid authenticator code.');
    } finally {
      setBusy(null);
    }
  };

  const handleDisable = async () => {
    if (!totpCode) {
      Alert.alert('Authenticator', 'Enter your current authenticator code to disable security.');
      return;
    }
    try {
      setBusy('disable');
      await disableTotp(totpCode);
      setTotpCode('');
      setTotpSecret(null);
      Alert.alert('Authenticator', 'Two-factor authentication has been disabled.');
    } catch (error: any) {
      Alert.alert('Authenticator', error?.message ?? 'Could not disable authenticator.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile & Settings</Text>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{user.display_name || user.username}</Text>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user.role.toUpperCase()}</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email || 'Not provided'}</Text>
          <Text style={styles.label}>Authenticator</Text>
          <Text style={styles.value}>{user.totp_enabled ? 'Enabled' : 'Disabled'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Authenticator code"
            value={totpCode}
            onChangeText={setTotpCode}
            keyboardType="number-pad"
            accessibilityLabel="Authenticator code"
          />
          {totpSecret ? (
            <View>
              <Text style={styles.label}>Manual setup code</Text>
              <Text style={styles.secret}>{totpSecret}</Text>
            </View>
          ) : null}
          <VoiceButton
            label={busy === 'setup' ? 'Generating...' : 'Get setup QR'}
            onPress={handleFetchTotp}
            accessibilityHint="Generate or view your authenticator setup details"
          />
          <VoiceButton
            label={busy === 'activate' ? 'Verifying...' : 'Enable authenticator'}
            onPress={handleActivate}
            accessibilityHint="Enable Google Authenticator protection"
          />
          <VoiceButton
            label={busy === 'disable' ? 'Removing...' : 'Disable authenticator'}
            onPress={handleDisable}
            accessibilityHint="Disable Google Authenticator protection"
          />
        </View>
      ) : null}
      <VoiceButton
        label="Switch role"
        onPress={logout}
        accessibilityHint="Signs out and returns to role selection"
      />
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
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    ...typography.helper,
    color: palette.textSecondary,
    letterSpacing: 0.5,
  },
  value: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.disabled,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
    marginTop: spacing.sm,
  },
  secret: {
    ...typography.body,
    color: palette.textSecondary,
  },
});
