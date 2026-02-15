import React from 'react';
import { StyleSheet, View, Button } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';

import { AppNavigator } from './src/navigation/AppNavigator';
import { palette } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

// Initialize Sentry
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE', // IMPORTANT: Replace with your actual Sentry DSN
  tracesSampleRate: 1.0,
});

const queryClient = new QueryClient();

const App = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.root}>
          <SafeAreaProvider>
            <AuthProvider>
              <NotificationProvider>
                <AppNavigator />
                <View style={styles.sentryButton}>
                  <Button
                    title="Trigger Sentry Test Error"
                    onPress={() => {
                      Sentry.captureException(new Error('Sentry Test Error'));
                    }}
                  />
                </View>
              </NotificationProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  sentryButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 999,
  },
});

export default Sentry.wrap(App);
