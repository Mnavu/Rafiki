import React from "react";
import { StatusBar, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AppNavigator } from "@navigation/AppNavigator";
import { WebNavigator } from "@navigation/web/WebNavigator";
import { palette } from "@theme/index";
import { AuthProvider } from "@context/AuthContext";
import { NotificationProvider } from "@context/NotificationContext";
import { useHydrateMe } from "@hooks/useHydration";
import { useRegisterDevice } from "@hooks/useRegisterDevice";

const queryClient = new QueryClient();

const HydrationBootstrapper = () => {
  const { data: me } = useHydrateMe();
  useRegisterDevice(!!me?.id);
  return null;
};

import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

const App = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.root}>

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
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardWrapper: {
    flex: 1,
  },
});

export default App;
