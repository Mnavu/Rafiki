import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  BottomUtilityBar,
  FloatingAssistantButton,
  AlertBanner,
  VoiceSearchBar,
  ChatWidget,
} from '@components/index';
import { palette, spacing } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { usePullToRefresh } from '@hooks/usePullToRefresh';

type AdminTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const adminTiles: AdminTile[] = [
  {
    key: 'users',
    title: 'Users & Roles',
    subtitle: 'Create accounts and link parents.',
    icon: 'people',
    navigateTo: 'AdminUsers',
  },
  {
    key: 'systems',
    title: 'Systems',
    subtitle: 'Manage integrations and schedulers.',
    icon: 'cog',
    navigateTo: 'AdminSystems',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    subtitle: 'Track logins, chatbot usage, alerts.',
    icon: 'analytics',
    navigateTo: 'AdminAnalytics',
  },
  {
    key: 'theme',
    title: 'Theme',
    subtitle: 'Control branding and voice settings.',
    icon: 'color-palette',
    navigateTo: 'AdminTheme',
  },
  {
    key: 'audit',
    title: 'Audit & Policies',
    subtitle: 'Review audit trails and retention rules.',
    icon: 'shield-checkmark',
    navigateTo: 'AdminAudit',
  },
];

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [showAssistant, setShowAssistant] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
      >
        <GreetingHeader name="System Admin" />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        <AlertBanner message="High-contrast mode enabled system wide" variant="success" />
        <View style={styles.tiles}>
          {adminTiles.map((tile) => (
            <DashboardTile
              key={tile.key}
              title={tile.title}
              subtitle={tile.subtitle}
              icon={<Ionicons name={tile.icon as any} size={28} color={palette.primary} />}
              onPress={() => navigation.navigate(tile.navigateTo as never)}
            />
          ))}
        </View>
      </ScrollView>
      <FloatingAssistantButton onPress={() => setShowAssistant(true)} />
      <BottomUtilityBar
        items={[
          { label: 'Home', isActive: true },
          { label: 'Search', onPress: () => navigation.navigate('Search') },
          { label: 'Profile', onPress: () => navigation.navigate('Profile') },
        ]}
      />
      {showAssistant ? <ChatWidget onClose={() => setShowAssistant(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: spacing.lg, paddingBottom: 160, gap: spacing.md },
  tiles: { gap: spacing.md },
});
