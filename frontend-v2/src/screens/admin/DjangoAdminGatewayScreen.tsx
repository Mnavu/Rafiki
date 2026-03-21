import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GreetingHeader, RoleBadge, VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { palette, spacing, typography } from '@theme/index';

const djangoAdminUrl = (() => {
  const base = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    return 'https://rafiki-ygwg.onrender.com/admin/';
  }
  return `${base}/admin/`;
})();

export const DjangoAdminGatewayScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, logout } = useAuth();

  return (
    <View style={styles.container}>
      <GreetingHeader
        name={state.user?.display_name || state.user?.username || 'Admin'}
        greeting="Use Django admin"
        rightAccessory={<RoleBadge role={state.user?.role === 'superadmin' ? 'superadmin' : 'admin'} />}
      />
      <View style={styles.card}>
        <Text style={styles.title}>Django admin is now the primary staff workspace.</Text>
        <Text style={styles.body}>
          Use the Django admin for users, finance clearance, HOD approvals, reports, audit logs,
          and password resets. The custom web control center is now legacy.
        </Text>
        <View style={styles.actions}>
          <VoiceButton
            label="Open Django admin"
            onPress={() => {
              void Linking.openURL(djangoAdminUrl);
            }}
            isActive
          />
          <VoiceButton
            label="Continue to legacy workspace"
            onPress={() => navigation.navigate('AdminControlCenter')}
            size="compact"
          />
          <VoiceButton label="Sign out" onPress={() => void logout()} size="compact" />
        </View>
        <Text style={styles.helper}>{djangoAdminUrl}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.disabled,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
  helper: {
    ...typography.helper,
    color: palette.textSecondary,
  },
});
