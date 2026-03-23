import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { palette, radius, spacing, typography } from '@theme/index';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { NotificationBellBadge } from './NotificationBellBadge';

interface GreetingHeaderProps {
  name: string;
  avatarUri?: string;
  onSpeak?: () => void;
  greeting?: string;
  rightAccessory?: React.ReactNode;
  notificationCount?: number;
  showNotificationBell?: boolean;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({
  name,
  avatarUri,
  onSpeak,
  greeting,
  rightAccessory,
  notificationCount,
  showNotificationBell = true,
}) => {
  const timeAwareGreeting = greeting ?? deriveGreeting();
  const { unreadCount, hasAuthenticatedUser } = useUnreadNotificationCount();
  const effectiveNotificationCount = notificationCount ?? unreadCount;
  const shouldShowBell = showNotificationBell && hasAuthenticatedUser;
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.greeting}>{timeAwareGreeting}</Text>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>
      <View style={styles.actions}>
        {shouldShowBell ? <NotificationBellBadge count={effectiveNotificationCount} /> : null}
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={onSpeak}
          accessibilityRole="button"
          accessibilityLabel="Read greeting aloud"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>{name[0]?.toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const deriveGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  info: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  accessory: {
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
  },
  greeting: {
    ...typography.headingM,
    color: palette.textSecondary,
  },
  name: {
    ...typography.headingL,
    color: palette.textPrimary,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.headingL,
    color: palette.surface,
  },
});
