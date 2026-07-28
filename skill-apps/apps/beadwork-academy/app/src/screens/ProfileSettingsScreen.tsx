import { BigActionButton, spacing, typography, useAccessibilityPrefs, useActivePalette } from "@skillapp-core/ui";
import Slider from "@react-native-community/slider";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Proves the real (non-cosmetic) high-contrast fix: toggling it here swaps
 * `useActivePalette()` app-wide via AccessibilityPrefsContext, not just this
 * button's own label - unlike Nanu's AppMenu, which only changed its own text.
 */
export function ProfileSettingsScreen() {
  const palette = useActivePalette();
  const { simpleMode, highContrast, speechRate, setSimpleMode, setHighContrast, setSpeechRate } =
    useAccessibilityPrefs();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.headingL, { color: palette.text }]}>Settings</Text>

        <View style={styles.row}>
          <Text style={[typography.bodyLarge, { color: palette.text, flex: 1 }]}>Simple mode</Text>
          <BigActionButton
            label={simpleMode ? "On" : "Off"}
            size="compact"
            isActive={simpleMode}
            onPress={() => setSimpleMode(!simpleMode)}
          />
        </View>
        <Text style={[typography.helper, { color: palette.textMuted }]}>Shows fewer items per screen at once.</Text>

        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <Text style={[typography.bodyLarge, { color: palette.text, flex: 1 }]}>High contrast</Text>
          <BigActionButton
            label={highContrast ? "On" : "Off"}
            size="compact"
            isActive={highContrast}
            onPress={() => setHighContrast(!highContrast)}
          />
        </View>
        <Text style={[typography.helper, { color: palette.textMuted }]}>
          Switches every screen to bold, high-contrast colors.
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.bodyLarge, { color: palette.text }]}>Voice speed: {speechRate.toFixed(1)}x</Text>
          <Slider
            minimumValue={0.5}
            maximumValue={1.5}
            step={0.1}
            value={speechRate}
            onValueChange={setSpeechRate}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
});
