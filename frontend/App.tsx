import React from 'react';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { palette } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

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
});

export default App;
