import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { palette, radius, spacing, typography } from '@theme/index';
import { useNotifications } from '@context/NotificationContext';
import type { RootStackParamList } from '@navigation/AppNavigator';

type NotificationBellProps = {
  size?: number;
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ size = 26 }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { notifications, unreadCount, markNotificationRead, markAllRead } = useNotifications();
  const [visible, setVisible] = useState(false);

  const hasUnread = unreadCount > 0;

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [notifications],
  );

  const open = () => setVisible(true);
  const close = () => setVisible(false);

  const handleSelect = (notificationId: string) => {
    const notification = sortedNotifications.find((item) => item.id === notificationId);
    if (!notification) {
      return;
    }
    markNotificationRead(notificationId);
    close();
    navigation.navigate(notification.route.name as any, notification.route.params as any);
  };

  const handleMarkAll = () => {
    markAllRead();
    close();
  };

  return (
    <>
      <TouchableOpacity
        onPress={open}
        style={styles.bell}
        accessibilityRole="button"
        accessibilityLabel="Open notifications"
        accessibilityHint="Shows recent updates and alerts"
      >
        <Ionicons
          name={hasUnread ? 'notifications' : 'notifications-outline'}
          size={size}
          color={palette.primary}
        />
        {hasUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{Math.min(unreadCount, 9)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Notifications</Text>
                  {notifications.length ? (
                    <TouchableOpacity onPress={handleMarkAll}>
                      <Text style={styles.panelAction}>Mark all read</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {sortedNotifications.length ? (
                  sortedNotifications.map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationCard,
                        !notification.read && styles.notificationCardUnread,
                      ]}
                      onPress={() => handleSelect(notification.id)}
                      accessibilityRole="button"
                      accessibilityHint="Opens the related screen"
                    >
                      <View style={styles.notificationIcon}>
                        <Ionicons
                          name={notification.type === 'thread' ? 'chatbubbles' : 'book'}
                          size={18}
                          color={palette.primary}
                        />
                      </View>
                      <View style={styles.notificationBody}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationText}>{notification.body}</Text>
                        <Text style={styles.notificationMeta}>
                          {new Date(notification.timestamp).toLocaleString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.empty}>
                    <Ionicons name="sparkles-outline" size={28} color={palette.accent} />
                    <Text style={styles.emptyTitle}>All caught up</Text>
                    <Text style={styles.emptyText}>
                      We will let you know the moment there is something new to review.
                    </Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bell: {
    padding: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.helper,
    color: palette.surface,
    fontSize: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-start',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  panelAction: {
    ...typography.helper,
    color: palette.primary,
  },
  notificationCard: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  notificationCardUnread: {
    backgroundColor: '#EDF3FF',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
    gap: spacing.xs,
  },
  notificationTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  notificationText: {
    ...typography.body,
    color: palette.textSecondary,
  },
  notificationMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  emptyText: {
    ...typography.helper,
    color: palette.textSecondary,
    textAlign: 'center',
  },
});
