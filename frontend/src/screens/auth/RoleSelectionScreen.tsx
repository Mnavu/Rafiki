import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DashboardTile,
  GreetingHeader,
  RoleBadge,
  VoiceButton,
  FloatingAssistantButton,
  ChatWidget,
  FaqModal,
} from '@components/index';
import { palette, spacing } from '@theme/index';
import type { Role } from '@app-types/roles';

type RoleOption = {
  key: Role;
  title: string;
  subtitle: string;
};

const roles = (t: (key: string) => string): RoleOption[] => [
  { key: 'student', title: t('roles.student'), subtitle: t('roles.student_subtitle') },
  { key: 'parent', title: t('roles.parent'), subtitle: t('roles.parent_subtitle') },
  { key: 'lecturer', title: t('roles.lecturer'), subtitle: t('roles.lecturer_subtitle') },
  { key: 'hod', title: t('roles.hod'), subtitle: t('roles.hod_subtitle') },
  { key: 'finance', title: t('roles.finance'), subtitle: t('roles.finance_subtitle') },
  {
    key: 'records',
    title: t('roles.records'),
    subtitle: t('roles.records_subtitle'),
  },
  { key: 'admin', title: t('roles.admin'), subtitle: t('roles.admin_subtitle') },
  {
    key: 'superadmin',
    title: t('roles.superadmin'),
    subtitle: t('roles.superadmin_subtitle'),
  },
];

interface RoleSelectionScreenProps {
  onSelectRole: (role: Role) => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ onSelectRole }) => {
  const { t } = useTranslation();
  const [showHelper, setShowHelper] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const greeting = useMemo(() => t('role_selection.title'), [t]);
  const roleOptions = useMemo(() => roles(t), [t]);

  return (
    <View style={styles.container}>
      <GreetingHeader name={t('role_selection.guest')} greeting={greeting} />
      <FlatList
        data={roleOptions}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <DashboardTile
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => onSelectRole(item.key)}
            icon={<RoleBadge role={item.key} />}
          />
        )}
      />
      <VoiceButton
        label={t('role_selection.need_help')}
        onPress={() => setShowFaq(true)}
        accessibilityHint={t('role_selection.faq_hint')}
      />
      <FloatingAssistantButton onPress={() => setShowHelper((s) => !s)} />
      {showHelper ? (
        <ChatWidget
          onClose={() => setShowHelper(false)}
          onNavigateRole={(role) => {
            setShowHelper(false);
            onSelectRole(role);
          }}
        />
      ) : null}
      <FaqModal visible={showFaq} onClose={() => setShowFaq(false)} />
    </View>
  );
};

const Separator: React.FC = () => <View style={{ height: spacing.md }} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
});
