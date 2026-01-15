import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from './Themed'; // Assuming a Themed Text component exists
import Colors from '../theme/Colors'; // Assuming a Colors theme file exists

interface DatePickerProps {
  value: Date;
  onChange: (event: any, date?: Date) => void;
  mode?: 'date' | 'time' | 'datetime';
  display?: 'default' | 'spinner' | 'calendar'; // 'calendar' for iOS >= 14, 'default' for others
  placeholder?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  mode = 'date',
  display = 'default',
  placeholder = 'Select Date',
  style,
  textStyle,
  disabled = false,
}) => {
  const [show, setShow] = useState(false);

  const toggleShow = () => {
    if (!disabled) {
      setShow(!show);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    toggleShow();
    if (selectedDate) {
      onChange(event, selectedDate);
    }
  };

  const formattedDate = value ? value.toLocaleDateString() : placeholder;
  const formattedTime = value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : placeholder;

  const renderDisplayValue = () => {
    if (mode === 'date') {
      return formattedDate;
    } else if (mode === 'time') {
      return formattedTime;
    } else { // datetime
      return `${formattedDate} ${formattedTime}`;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={toggleShow} disabled={disabled} style={styles.touchable}>
        <Text style={[styles.dateText, textStyle, disabled && styles.disabledText]}>
          {value ? renderDisplayValue() : placeholder}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          testID="dateTimePicker"
          value={value || new Date()} // Fallback to current date if value is null
          mode={mode}
          display={Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 14 ? display : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date(1900, 0, 1)} // Sensible minimum date
          maximumDate={new Date(2100, 11, 31)} // Sensible maximum date
          accentColor={Colors.tint} // Customize for Android (iOS uses global tint)
          textColor={Colors.text} // Customize for iOS 14+ (not available for older iOS/Android)
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Basic styling for the container, adjust as needed
  },
  touchable: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.light.text, // Assuming text color from theme
    borderRadius: 8,
    backgroundColor: Colors.light.background, // Assuming background color from theme
  },
  dateText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  disabledText: {
    color: Colors.dark.text, // Lighter color for disabled state
  },
});

export default DatePicker;
