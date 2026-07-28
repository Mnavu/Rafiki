import { BigActionButton, spacing, typography, useActivePalette } from "@skillapp-core/ui";
import React, { useState } from "react";
import { SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "../../context/AuthContext";

export function LoginScreen() {
  const palette = useActivePalette();
  const { login, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.content}>
        <Text style={[typography.headingXL, { color: palette.text, marginBottom: spacing.sm }]}>
          Beadwork Academy
        </Text>
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
          Sign in to start your lesson.
        </Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
          accessibilityLabel="Username"
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          accessibilityLabel="Password"
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        />

        {error ? (
          <Text style={[typography.helper, { color: palette.danger, marginBottom: spacing.md }]}>{error}</Text>
        ) : null}

        <BigActionButton
          label={submitting ? "Signing in..." : "Sign in"}
          icon="👉"
          disabled={submitting || !username || !password}
          onPress={handleLogin}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 18,
    marginBottom: spacing.md,
  },
});
