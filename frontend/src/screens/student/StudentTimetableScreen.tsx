import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface ClassSlot {
    time: string;
    subject: string;
    room: string;
    action: string;
    date: Date;
}

const classesData: ClassSlot[] = [
  { time: '08:00', subject: 'Mathematics', room: 'B-204', action: 'Join lesson', date: new Date() },
  { time: '10:00', subject: 'Science Lab', room: 'Lab 1', action: 'Start experiment', date: new Date() },
  { time: '13:30', subject: 'Art Therapy', room: 'Studio', action: 'View materials', date: new Date() },
  { time: '09:00', subject: 'History', room: 'C-101', action: 'Join lesson', date: new Date(new Date().setDate(new Date().getDate() + 1)) },
];

export const StudentTimetableScreen: React.FC = () => {
    const [filterDate, setFilterDate] = useState<Date | null>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const filteredClasses = useMemo(() => {
        if (!filterDate) {
          return classesData;
        }
        return classesData.filter(
          (item) => item.date.getFullYear() === filterDate.getFullYear() &&
                   item.date.getMonth() === filterDate.getMonth() &&
                   item.date.getDate() === filterDate.getDate()
        );
    }, [filterDate]);


    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>{filterDate ? filterDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Timetable'}</Text>
            <Text style={styles.subtitle}>Tap any card to hear the details or join a virtual class.</Text>

            <View style={styles.filterContainer}>
                <VoiceButton
                    label={filterDate ? `Filtering for: ${filterDate.toLocaleDateString()}` : 'Filter by Date'}
                    onPress={() => setShowDatePicker(true)}
                />
                {filterDate && <VoiceButton label="Show All" onPress={() => setFilterDate(null)} />}
            </View>

            {showDatePicker && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={filterDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            {filteredClasses.length > 0 ? filteredClasses.map((item) => (
            <View key={item.subject} style={styles.card}>
                <View style={styles.iconWrapper}>
                <Ionicons name="time" size={28} color={palette.primary} />
                </View>
                <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.subject}</Text>
                <Text style={styles.cardMeta}>
                    {item.time} · Room {item.room}
                </Text>
                <VoiceButton label={item.action} onPress={() => {}} />
                </View>
            </View>
            )) : (
                <Text style={styles.noResults}>No classes scheduled for this date.</Text>
            )}

            <VoiceButton
            label="Speak entire timetable"
            onPress={() => {}}
            accessibilityHint="Read out schedule"
            />
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
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    gap: spacing.lg,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  noResults: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
});
