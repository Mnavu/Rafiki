import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@context/AuthContext';
import { fetchNotifications } from '@services/api';

export const useUnreadNotificationCount = () => {
  const { state } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (!state.accessToken || !state.user) {
      setUnreadCount(0);
      return;
    }
    try {
      const notifications = await fetchNotifications(state.accessToken);
      setUnreadCount(
        notifications.filter((item) => item.channel === 'in_app' && item.status !== 'read').length,
      );
    } catch {
      setUnreadCount(0);
    }
  }, [state.accessToken, state.user]);

  useEffect(() => {
    if (!state.accessToken || !state.user) {
      setUnreadCount(0);
    }
  }, [state.accessToken, state.user]);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadCount();
    }, [loadUnreadCount]),
  );

  return {
    unreadCount,
    hasAuthenticatedUser: !!state.accessToken && !!state.user,
  };
};
