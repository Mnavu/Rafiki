import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { DatePicker, VoiceButton } from '@components/index';

const conflictsData = [{ course: 'ICT201', conflict: 'Overlaps with ENG110 on Monday 10 AM', date: new Date() }];

export const HodTimetableScreen: React.FC = () => {
    const [filterDate, setFilterDate] = useState<Date | null>(new Date());

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const filteredConflicts = useMemo(() => {
        if (!filterDate) {
            return conflictsData;
        }
        return conflictsData.filter(
            (item) =>
                item.date.getFullYear() === filterDate.getFullYear() &&
                item.date.getMonth() === filterDate.getMonth() &&
                item.date.getDate() === filterDate.getDate()
        );
    }, [filterDate]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Department Timetable</Text>
            <Text style={styles.subtitle}>Review proposed schedules and highlight clashes instantly.</Text>

            <View style={styles.filterContainer}>
                <DatePicker
                    value={filterDate || new Date()}
                    onChange={onDateChange}
                    placeholder={filterDate ? `Filtering for: ${filterDate.toLocaleDateString()}` : 'Filter by Date'}
                />
                {filterDate && <VoiceButton label="Show All" onPress={() => setFilterDate(null)} />}
            </View>

            {filteredConflicts.map((item) => (
            <View key={item.course} style={styles.card}>
                <Ionicons name="warning" size={28} color={palette.danger} />
                <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.course}</Text>
                <Text style={styles.cardMeta}>{item.conflict}</Text>
                <VoiceButton label="Resolve" onPress={() => {}} />
                </View>
            </View>
            ))}
            <VoiceButton label="Approve timetable" onPress={() => {}} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, backgroundColor: palette.background },
  title: { ...typography.headingXL, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary },
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
  cardBody: { flex: 1, gap: spacing.sm },
  cardTitle: { ...typography.headingM, color: palette.textPrimary },
  cardMeta: { ...typography.body, color: palette.textSecondary },
});
