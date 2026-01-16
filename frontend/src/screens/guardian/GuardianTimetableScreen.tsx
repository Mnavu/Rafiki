import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { DatePicker, VoiceButton } from '@components/index';

const timetableData = [
  { time: '08:00', activity: 'Math lesson', location: 'Room B204', date: new Date() },
  { time: '10:00', activity: 'Science Lab', location: 'Lab 1', date: new Date() },
  { time: '14:00', activity: 'Therapy session', location: 'Wellness Center', date: new Date() },
  { time: '09:00', activity: 'History', location: 'C-101', date: new Date(new Date().setDate(new Date().getDate() + 1)) },
];

export const GuardianTimetableScreen: React.FC = () => {
    const [filterDate, setFilterDate] = useState<Date | null>(new Date());

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const filteredTimetable = useMemo(() => {
        if (!filterDate) {
            return timetableData;
        }
        return timetableData.filter(
            (item) =>
                item.date.getFullYear() === filterDate.getFullYear() &&
                item.date.getMonth() === filterDate.getMonth() &&
                item.date.getDate() === filterDate.getDate()
        );
    }, [filterDate]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Child&apos;s Timetable</Text>
            <Text style={styles.subtitle}>Follow the day and set spoken reminders 15 minutes ahead.</Text>

            <View style={styles.filterContainer}>
                <DatePicker
                    value={filterDate || new Date()}
                    onChange={onDateChange}
                    placeholder={filterDate ? `Filtering for: ${filterDate.toLocaleDateString()}` : 'Filter by Date'}
                />
                {filterDate && <VoiceButton label="Show All" onPress={() => setFilterDate(null)} />}
            </View>

            {filteredTimetable.map((slot) => (
            <View key={slot.activity} style={styles.card}>
                <Ionicons name="time" size={28} color={palette.secondary} />
                <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{slot.activity}</Text>
                <Text style={styles.cardMeta}>
                    {slot.time} - {slot.location}
                </Text>
                <VoiceButton label="Set reminder" onPress={() => {}} />
                </View>
            </View>
            ))}
            <VoiceButton label="Speak timetable" onPress={() => {}} />
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
  arrow: {
    padding: spacing.sm,
  },
  yearText: {
    ...typography.headingM,
    color: palette.textPrimary,
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
});
