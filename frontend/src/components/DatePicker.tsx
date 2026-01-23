import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle, TextStyle, Modal, Pressable, Text } from 'react-native';
import Colors from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerProps {
  value: Date;
  onChange: (event: any, date?: Date) => void;
  placeholder?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select Date',
  style,
  textStyle,
  disabled = false,
}) => {
  const [show, setShow] = useState(false);
  const [currentDate, setCurrentDate] = useState(value || new Date());

  const toggleShow = () => {
    if (!disabled) {
      setShow(!show);
    }
  };

  const handleDateChange = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onChange({}, newDate);
    setShow(false);
  };

  const changeMonth = (amount: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1));
  };

  const changeYear = (amount: number) => {
    setCurrentDate(new Date(currentDate.getFullYear() + amount, currentDate.getMonth(), 1));
  };


  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeYear(-1)}>
            <Ionicons name="chevron-back-outline" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeMonth(-1)}>
          <Ionicons name="arrow-back-outline" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)}>
          <Ionicons name="arrow-forward-outline" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeYear(1)}>
            <Ionicons name="chevron-forward-outline" size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDaysOfWeek = () => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <View style={styles.daysOfWeek}>
        {days.map((day, index) => (
          <Text key={index} style={styles.dayOfWeekText}>
            {day}
          </Text>
        ))}
      </View>
    );
  };

  const renderDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<View key={`empty-${i}`} style={styles.day} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = value && day === value.getDate() && month === value.getMonth() && year === value.getFullYear();
      days.push(
        <TouchableOpacity
          key={day}
          style={[styles.day, isSelected && styles.selectedDay]}
          onPress={() => handleDateChange(day)}
        >
          <Text style={isSelected && styles.selectedDayText}>{day}</Text>
        </TouchableOpacity>
      );
    }
    return <View style={styles.daysContainer}>{days}</View>;
  };

  const formattedDate = value ? value.toLocaleDateString() : placeholder;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={toggleShow} disabled={disabled} style={styles.touchable}>
        <Text style={[styles.dateText, textStyle, disabled && styles.disabledText]}>
          {value ? formattedDate : placeholder}
        </Text>
      </TouchableOpacity>
      <Modal
        transparent={true}
        animationType="slide"
        visible={show}
        onRequestClose={toggleShow}
      >
        <Pressable style={styles.modalOverlay} onPress={toggleShow}>
            <View style={styles.modalContent}>
              {renderHeader()}
              {renderDaysOfWeek()}
              {renderDays()}
            </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {},
    touchable: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: Colors.light.text,
        borderRadius: 8,
        backgroundColor: Colors.light.background,
    },
    dateText: {
        fontSize: 16,
        color: Colors.light.text,
    },
    disabledText: {
        color: Colors.dark.text,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        width: '90%',
        backgroundColor: Colors.light.background,
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    daysOfWeek: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 10,
    },
    dayOfWeekText: {
        width: 30,
        textAlign: 'center',
        color: Colors.light.text,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
    },
    day: {
        width: '14.2%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedDay: {
        backgroundColor: Colors.tint,
        borderRadius: 20,
    },
    selectedDayText: {
        color: '#fff',
    },
});

export default DatePicker;
