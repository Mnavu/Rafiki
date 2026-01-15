import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Text, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { createResource, type CreateResourcePayload, fetchCourses, type ApiCourse } from '@services/api';

const markingQueue = [
  { title: 'ICT201 Homework 4', submissions: 12, due: 'Submitted today', action: 'Open grading' },
  { title: 'ICT305 Reflection', submissions: 8, due: 'Due tomorrow', action: 'Send reminder' },
];

export const LecturerAssignmentsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state } = useAuth();
  const token = state.accessToken;
  const lecturerId = state.user?.id ?? null;

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'Camera' | 'Files' | 'Voice' | 'Link'>('Files');
  const [picked, setPicked] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [courseId, setCourseId] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !courseId) {
      return false;
    }
    if (source === 'Link') {
      return !!linkUrl.trim();
    }
    return !!picked;
  }, [courseId, linkUrl, picked, source, title]);

  useEffect(() => {
    if (!token || !lecturerId) {
      setCourses([]);
      setCourseId(null);
      return;
    }
    let active = true;
    const loadCourses = async () => {
      try {
        const data = await fetchCourses(token);
        const owned = data.filter((course) => course.lecturer === lecturerId);
        if (!active) {return;}
        setCourses(owned);
        if (owned.length && !courseId) {
          setCourseId(owned[0].id);
        }
      } catch (error) {
        console.warn('Failed to load lecturer courses', error);
        if (active) {
          setCourses([]);
          setCourseId(null);
        }
      }
    };
    loadCourses();
    return () => {
      active = false;
    };
  }, [courseId, lecturerId, token]);

  const handlePick = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      // Types can differ across SDKs; be defensive
      const canceled = (result as any).canceled === true;
      if (canceled) {
        return;
      }
      const asset = (result as any).assets?.[0];
      if (asset?.uri) {
        setPicked({ uri: asset.uri, mimeType: asset.mimeType || undefined });
      }
    } catch (error) {
      console.warn('Document pick failed', error);
      Alert.alert('Pick failed', 'We could not open your files. Try again.');
    }
  }, []);

  const submitUpload = useCallback(async () => {
    if (!token) {
      Alert.alert('Not signed in', 'Please login again to upload.');
      return;
    }
    if (!courseId) {
      Alert.alert('Pick a course', 'Select the course this material belongs to.');
      return;
    }
    try {
      setSubmitting(true);
      const payload: CreateResourcePayload = {
        title: title.trim(),
        description: `${description?.trim() || ''}${
          description ? '\n' : ''
        }Uploaded from: ${source}`.trim(),
        kind:
          source === 'Voice'
            ? 'audio'
            : source === 'Camera'
            ? 'image'
            : source === 'Link'
            ? 'link'
            : 'document',
        url: source === 'Link' ? linkUrl.trim() : undefined,
        fileUri: source === 'Link' ? undefined : picked?.uri,
        fileMimeType: picked?.mimeType,
        course: courseId,
      };
      const created = await createResource(token, payload);
      setShowUpload(false);
      setTitle('');
      setDescription('');
      setPicked(null);
      setLinkUrl('');
      setCourseId(courseId ?? null);
      Alert.alert('Uploaded', `Saved "${created.title}" to the Library.`);
    } catch (error: any) {
      console.warn('Upload failed', error);
      const message = error?.message || 'Unable to upload the resource.';
      Alert.alert('Upload failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [courseId, description, linkUrl, picked, source, title, token]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Assignments & Marking</Text>
      <Text style={styles.subtitle}>
        Check recent submissions, give audio feedback, and share new tasks.
      </Text>
      {markingQueue.map((item) => (
        <View key={item.title} style={styles.card}>
          <Ionicons name="reader" size={28} color={palette.accent} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.submissions} submissions · {item.due}
            </Text>
            <VoiceButton
              label={item.action}
              onPress={() => navigation.navigate('LecturerRecords')}
              accessibilityHint="Opens the grading view"
            />
          </View>
        </View>
      ))}
      <VoiceButton
        label={submitting ? 'Uploading...' : 'Create new assignment'}
        onPress={() => setShowUpload(true)}
        accessibilityHint="Upload a new assignment to the Library"
      />

      <Modal visible={showUpload} animationType="slide" onRequestClose={() => setShowUpload(false)}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Upload to Library</Text>
          <Text style={styles.modalLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. ICT201 Homework 5"
          />

          <Text style={styles.modalLabel}>Where are you uploading from?</Text>
          <View style={styles.sourceRow}>
            {(['Camera', 'Files', 'Voice', 'Link'] as const).map((s) => (
              <Text
                key={s}
                onPress={() => setSource(s)}
                style={[styles.sourcePill, source === s && styles.sourcePillActive]}
              >
                {s}
              </Text>
            ))}
          </View>

          {source === 'Link' ? (
            <>
              <Text style={styles.modalLabel}>Link URL</Text>
              <TextInput
                style={styles.input}
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoCapitalize="none"
                placeholder="https://example.com/material.pdf"
              />
            </>
          ) : (
            <>
              <Text style={styles.modalLabel}>File</Text>
              <VoiceButton label={picked ? 'Change file' : 'Pick a file'} onPress={handlePick} />
              {picked ? <Text style={styles.fileHint}>{picked.uri.split('/').pop()}</Text> : null}
            </>
          )}

          <Text style={styles.modalLabel}>Course</Text>
          {courses.length ? (
            <View style={styles.sourceRow}>
              {courses.map((course) => (
                <Text
                  key={course.id}
                  onPress={() => setCourseId(course.id)}
                  style={[styles.sourcePill, courseId === course.id && styles.sourcePillActive]}
                >
                  {course.code} • {course.name}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>
              You do not have any courses assigned yet. Once a course is assigned, you can place
              materials directly in it.
            </Text>
          )}

          <Text style={styles.modalLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Short details that help students"
          />

          <View style={styles.modalActions}>
            <VoiceButton label="Cancel" onPress={() => setShowUpload(false)} />
            <VoiceButton
              label={submitting ? 'Uploading...' : 'Upload'}
              onPress={submitUpload}
              isActive={canSubmit && !submitting}
            />
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: palette.background,
  },
  title: {
    ...typography.headingXL,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardBody: {
    flex: 1,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  cardMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  modal: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
  modalTitle: {
    ...typography.headingXL,
    color: palette.textPrimary,
  },
  modalLabel: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
  },
  inputMultiline: {
    height: 100,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourcePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: palette.surface,
    color: palette.textSecondary,
  },
  sourcePillActive: {
    backgroundColor: palette.primary,
    color: palette.surface,
  },
  fileHint: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  modalActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
});

export default LecturerAssignmentsScreen;
