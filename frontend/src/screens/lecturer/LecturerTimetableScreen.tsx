import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, Text, Modal, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

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

    const [newTitle, setNewTitle] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [newStart, setNewStart] = useState(new Date());
    const [newEnd, setNewEnd] = useState(new Date());

    const [isPickingStart, setIsPickingStart] = useState(false);

    const onStartTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        const currentDate = selectedDate || newStart;
        setIsPickingStart(false);
        setNewStart(currentDate);
    };

    const onEndTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        const currentDate = selectedDate || newEnd;
        setNewEnd(currentDate);
    };

    const handleAddSlot = () => {
        if (!newTitle.trim() || !newRoom.trim()) {
            Alert.alert('Missing Info', 'Please fill out a title and room.');
            return;
        }
        const newSlot: TimetableSlot = {
            id: Math.random().toString(),
            title: newTitle.trim(),
            room: newRoom.trim(),
            start: newStart,
            end: newEnd,
        };
        setSlots([...slots, newSlot].sort((a,b) => a.start.getTime() - b.start.getTime()));

        // Reset form
        setNewTitle('');
        setNewRoom('');
        setNewStart(new Date());
        setNewEnd(new Date());
        setShowModal(false);
    };

    const groupedSlots = slots.reduce((acc, slot) => {
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
                    <VoiceButton label={newStart.toLocaleString()} onPress={() => setIsPickingStart(true)} />
                     {isPickingStart && (
                        <DateTimePicker
                            value={newStart}
                            mode="datetime"
                            display="default"
                            onChange={onStartTimeChange}
                        />
                    )}

                    <Text style={styles.modalLabel}>End Time</Text>
                    <DateTimePicker
                        value={newEnd}
                        mode="datetime"
                        display="default"
                        onChange={onEndTimeChange}
                    />

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
  modalActions: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
});
