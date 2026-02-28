import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { DatePicker, VoiceButton } from '@components/index';

interface TimetableSlot {
  id: string;
  title: string;
  room: string;
  start: Date;
  end: Date;
}

const initialWeek: TimetableSlot[] = [
  { id: '1', title: 'ICT201', room: 'B302', start: new Date('2024-10-28T08:00:00'), end: new Date('2024-10-28T10:00:00') },
  { id: '2', title: 'Advisory', room: 'Counseling Room', start: new Date('2024-10-28T14:00:00'), end: new Date('2024-10-28T15:00:00') },
  { id: '3', title: 'ICT305', room: 'Innovation Lab', start: new Date('2024-10-30T10:00:00'), end: new Date('2024-10-30T12:00:00') },
];

type DayGrouping = {
    day: string;
    slots: TimetableSlot[];
}

export const LecturerTimetableScreen: React.FC = () => {
    const [slots, setSlots] = useState<TimetableSlot[]>(initialWeek);
    const [showModal, setShowModal] = useState(false);
    const [filterDate, setFilterDate] = useState<Date | null>(new Date());

    const [newTitle, setNewTitle] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [newStartDate, setNewStartDate] = useState(new Date());
    const [newEndDate, setNewEndDate] = useState(new Date());
    const [newStartTime, setNewStartTime] = useState(formatTime(new Date()));
    const [newEndTime, setNewEndTime] = useState(formatTime(new Date()));

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const onStartDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setNewStartDate(selectedDate);
        }
    };

    const onEndDateChange = (event: any, selectedDate?: Date) => {
        if (selectedDate) {
            setNewEndDate(selectedDate);
        }
    };

    const handleAddSlot = () => {
        if (!newTitle.trim() || !newRoom.trim()) {
            Alert.alert('Missing Info', 'Please fill out a title and room.');
            return;
        }
        const startDateTime = buildDateTime(newStartDate, newStartTime);
        if (!startDateTime) {
            Alert.alert('Invalid start time', 'Use HH:MM in 24-hour format (e.g. 08:30).');
            return;
        }
        const endDateTime = buildDateTime(newEndDate, newEndTime);
        if (!endDateTime) {
            Alert.alert('Invalid end time', 'Use HH:MM in 24-hour format (e.g. 14:15).');
            return;
        }
        if (endDateTime.getTime() <= startDateTime.getTime()) {
            Alert.alert('Invalid time range', 'End time must be after the start time.');
            return;
        }
        const newSlot: TimetableSlot = {
            id: Math.random().toString(),
            title: newTitle.trim(),
            room: newRoom.trim(),
            start: startDateTime,
            end: endDateTime,
        };
        setSlots([...slots, newSlot].sort((a,b) => a.start.getTime() - b.start.getTime()));

        // Reset form
        setNewTitle('');
        setNewRoom('');
        setNewStartDate(new Date());
        setNewEndDate(new Date());
        setNewStartTime(formatTime(new Date()));
        setNewEndTime(formatTime(new Date()));
        setShowModal(false);
    };

    const filteredSlots = useMemo(() => {
        if (!filterDate) {
            return slots;
        }
        return slots.filter(
            (slot) =>
                slot.start.getFullYear() === filterDate.getFullYear() &&
                slot.start.getMonth() === filterDate.getMonth() &&
                slot.start.getDate() === filterDate.getDate()
        );
    }, [slots, filterDate]);

    const groupedSlots = filteredSlots.reduce((acc, slot) => {
        const day = slot.start.toLocaleDateString('en-US', { weekday: 'long' });
        const existing = acc.find(d => d.day === day);
        if (existing) {
            existing.slots.push(slot);
        } else {
            acc.push({ day, slots: [slot] });
        }
        return acc;
    }, [] as DayGrouping[]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Weekly Timetable</Text>
            <Text style={styles.subtitle}>Toggle reminders or send reschedule notices.</Text>

            <View style={styles.filterContainer}>
                <DatePicker
                    value={filterDate || new Date()}
                    onChange={onDateChange}
                    placeholder={filterDate ? `Filtering for: ${filterDate.toLocaleDateString()}` : 'Filter by Date'}
                />
                {filterDate && <VoiceButton label="Show All" onPress={() => setFilterDate(null)} />}
            </View>

            {groupedSlots.map((day) => (
            <View key={day.day} style={styles.card}>
                <View style={styles.cardHeader}>
                <Ionicons name="calendar" size={24} color={palette.primary} />
                <Text style={styles.cardTitle}>{day.day}</Text>
                </View>
                {day.slots.map((slot) => (
                <Text key={slot.id} style={styles.slot}>
                    {`${slot.title} ${slot.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${slot.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${slot.room}`}
                </Text>
                ))}
            </View>
            ))}
            <VoiceButton label="Add New Slot" onPress={() => setShowModal(true)} />

            <Modal visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
                <ScrollView contentContainerStyle={styles.modal}>
                    <Text style={styles.modalTitle}>Add Timetable Slot</Text>

                    <Text style={styles.modalLabel}>Event Title</Text>
                    <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. ICT201 Lecture"/>

                    <Text style={styles.modalLabel}>Room / Location</Text>
                    <TextInput style={styles.input} value={newRoom} onChangeText={setNewRoom} placeholder="e.g. Room B302"/>

                    <Text style={styles.modalLabel}>Start Time</Text>
                    <View style={styles.dateTimeRow}>
                        <DatePicker
                            value={newStartDate}
                            onChange={onStartDateChange}
                            placeholder="Start date"
                            style={styles.datePicker}
                        />
                        <TextInput
                            style={styles.timeInput}
                            value={newStartTime}
                            onChangeText={setNewStartTime}
                            placeholder="HH:MM"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>

                    <Text style={styles.modalLabel}>End Time</Text>
                    <View style={styles.dateTimeRow}>
                        <DatePicker
                            value={newEndDate}
                            onChange={onEndDateChange}
                            placeholder="End date"
                            style={styles.datePicker}
                        />
                        <TextInput
                            style={styles.timeInput}
                            value={newEndTime}
                            onChangeText={setNewEndTime}
                            placeholder="HH:MM"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.modalActions}>
                        <VoiceButton label="Cancel" onPress={() => setShowModal(false)} />
                        <VoiceButton label="Add Slot" onPress={handleAddSlot} isActive={!!newTitle && !!newRoom} />
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
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  slot: {
    ...typography.body,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  datePicker: {
    flex: 1,
  },
  timeInput: {
    minWidth: 110,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.disabled,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  modalActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
});

const padTime = (value: number) => String(value).padStart(2, '0');

const formatTime = (date: Date) => `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;

const parseTime = (value: string) => {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
};

const buildDateTime = (date: Date, time: string) => {
  const parsed = parseTime(time);
  if (!parsed) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), parsed.hours, parsed.minutes, 0, 0);
};
