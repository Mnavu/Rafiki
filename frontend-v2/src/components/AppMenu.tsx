import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { palette, spacing } from '@theme/index';
import { VoiceButton } from './VoiceButton';

export type AppMenuAction = {
  label: string;
  onPress: () => void | Promise<void>;
  hidden?: boolean;
};

type AppMenuProps = {
  actions: AppMenuAction[];
  simpleMode?: boolean;
  highContrast?: boolean;
  onToggleSimpleMode?: () => void;
  onToggleHighContrast?: () => void;
  compact?: boolean;
};

export const AppMenu: React.FC<AppMenuProps> = ({
  actions,
  simpleMode,
  highContrast,
  onToggleSimpleMode,
  onToggleHighContrast,
  compact = false,
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const visibleActions = useMemo(() => actions.filter((item) => !item.hidden), [actions]);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <VoiceButton
        label={open ? 'Close menu' : 'Open menu'}
        size="compact"
        style={styles.menuToggle}
        onPress={() => setOpen((current) => !current)}
      />
      {open ? (
        <View style={styles.content}>
          {onToggleSimpleMode ? (
            <VoiceButton
              label={`Simple mode: ${simpleMode === false ? 'Off' : 'On'}`}
              size="compact"
              style={styles.actionButton}
              onPress={onToggleSimpleMode}
            />
          ) : null}
          {onToggleHighContrast ? (
            <VoiceButton
              label={`High contrast: ${highContrast ? 'On' : 'Off'}`}
              size="compact"
              style={styles.actionButton}
              onPress={onToggleHighContrast}
            />
          ) : null}
          {route.name !== 'ProfileSettings' ? (
            <VoiceButton
              label="Account settings"
              size="compact"
              style={styles.actionButton}
              onPress={() => navigation.navigate('ProfileSettings')}
            />
          ) : null}
          {visibleActions.map((action, index) => (
            <VoiceButton
              key={`menu-action-${action.label}-${index}`}
              label={action.label}
              size="compact"
              style={styles.actionButton}
              onPress={action.onPress}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: palette.background,
    gap: spacing.sm,
  },
  compactContainer: {
    padding: spacing.md,
  },
  menuToggle: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    flexBasis: '48%',
    flexGrow: 1,
  },
});
