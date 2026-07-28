import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DashboardTile, spacing, typography, useAccessibilityPrefs, useActivePalette } from "@skillapp-core/ui";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text } from "react-native";

import { useAuth } from "../../context/AuthContext";
import { fetchModuleLessons, fetchModules, LessonSummary, ModuleSummary } from "../../services/api";
import { RootStackParamList } from "../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ModuleList">;

type ModuleWithLessons = ModuleSummary & { lessons: LessonSummary[] };

export function ModuleListScreen({ navigation }: Props) {
  const palette = useActivePalette();
  const { accessToken } = useAuth();
  const { simpleMode } = useAccessibilityPrefs();
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const list = await fetchModules(accessToken);
    const withLessons = await Promise.all(
      list.map(async (m) => ({ ...m, lessons: m.locked ? [] : await fetchModuleLessons(accessToken, m.code) }))
    );
    setModules(withLessons);
  }, [accessToken]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const visibleModules = simpleMode ? modules.slice(0, 2) : modules;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {visibleModules.map((module) => (
          <React.Fragment key={module.code}>
            <Text style={[typography.headingM, { color: palette.text, marginTop: spacing.lg }]}>
              {module.title} {module.completed ? "✅" : module.locked ? "🔒" : ""}
            </Text>
            {module.summary ? (
              <Text style={[typography.helper, { color: palette.textMuted, marginBottom: spacing.sm }]}>
                {module.summary}
              </Text>
            ) : null}
            {module.locked ? (
              <Text style={[typography.body, { color: palette.textMuted }]}>
                Finish the module before this one to unlock it.
              </Text>
            ) : (
              module.lessons.map((lesson) => (
                <DashboardTile
                  key={lesson.code}
                  title={lesson.title}
                  subtitle={`${lesson.estimated_minutes} min${lesson.is_new_technique ? " · new skill" : ""}`}
                  icon={lesson.is_new_technique ? "🎬" : "🔁"}
                  onPress={() => navigation.navigate("LessonPlayer", { lessonCode: lesson.code, moduleCode: module.code })}
                />
              ))
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
});
