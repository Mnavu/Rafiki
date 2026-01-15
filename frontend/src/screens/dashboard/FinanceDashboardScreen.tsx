import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, Text, RefreshControl } from 'react-native';
import {
  GreetingHeader,
  DashboardTile,
  BottomUtilityBar,
  FloatingAssistantButton,
  AlertBanner,
  VoiceSearchBar,
  ChatWidget,
} from '@components/index';
import { palette, spacing, typography } from '@theme/index';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { usePullToRefresh } from '@hooks/usePullToRefresh';

const kpis = [
  { label: 'Total Due', value: 'KES 2.4M', color: palette.danger },
  { label: 'Collected', value: 'KES 1.8M', color: palette.success },
  { label: 'Overdue', value: 'KES 600K', color: palette.warning },
];

type FinanceTile = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  navigateTo: keyof RootStackParamList;
};

const financeTiles: FinanceTile[] = [
  {
    key: 'overview',
    title: 'Fees Overview',
    subtitle: 'KPIs with spoken summaries.',
    icon: 'analytics',
    navigateTo: 'FinanceOverview',
  },
  {
    key: 'students',
    title: 'Students',
    subtitle: 'View ledgers and record payments.',
    icon: 'person-circle',
    navigateTo: 'FinanceStudents',
  },
  {
    key: 'invoices',
    title: 'Invoices',
    subtitle: 'Send receipts via WhatsApp/SMS.',
    icon: 'paper-plane',
    navigateTo: 'FinanceInvoices',
  },
  {
    key: 'alerts',
    title: 'Alerts',
    subtitle: 'Schedule reminders and bulk outreach.',
    icon: 'notifications',
    navigateTo: 'FinanceAlerts',
  },
  {
    key: 'settings',
    title: 'Settings',
    subtitle: 'Manage fee items, waivers, plans.',
    icon: 'settings',
    navigateTo: 'FinanceSettings',
  },
];

export const FinanceDashboardScreen: React.FC = () => {
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
        <GreetingHeader name="Finance Team" />
        <VoiceSearchBar
          onPress={() => navigation.navigate('Search')}
          onVoicePress={() => navigation.navigate('Search')}
        />
        <AlertBanner message="45 overdue accounts" variant="warning" />
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <View
              key={kpi.label}
              style={[styles.kpiCard, { borderColor: kpi.color }]}
              accessibilityLabel={`${kpi.label} ${kpi.value}`}
            >
              <Ionicons name="speedometer" size={24} color={kpi.color} />
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
            </View>
          ))}
        </View>
        {financeTiles.map((tile) => (
          <DashboardTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            icon={<Ionicons name={tile.icon as any} size={28} color={palette.primary} />}
            onPress={() => navigation.navigate(tile.navigateTo as never)}
          />
        ))}
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
  scroll: { padding: spacing.lg, paddingBottom: 160, gap: spacing.lg },
  kpiRow: { flexDirection: 'row', gap: spacing.md },
  kpiCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: palette.surface,
    gap: spacing.sm,
  },
  kpiLabel: { ...typography.helper, color: palette.textSecondary },
  kpiValue: { ...typography.headingM, color: palette.textPrimary },
});
