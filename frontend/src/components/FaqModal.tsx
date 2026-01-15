import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { palette, spacing, typography, radius } from '@theme/index';
import { globalFaq } from '@data/faq';

type FaqModalProps = {
  visible: boolean;
  onClose: () => void;
};

export const FaqModal: React.FC<FaqModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Need a quick answer?</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close FAQs"
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {globalFaq.map((faq) => (
              <View key={faq.question} style={styles.item}>
                <Text style={styles.question}>{faq.question}</Text>
                <Text style={styles.answer}>{faq.answer}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  closeText: {
    ...typography.helper,
    color: palette.accent,
  },
  content: {
    gap: spacing.md,
  },
  item: {
    padding: spacing.md,
    backgroundColor: palette.background,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  question: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  answer: {
    ...typography.body,
    color: palette.textSecondary,
  },
});
