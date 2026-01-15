import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Text } from '@components/Themed';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import Colors from '@theme/Colors';

type NotificationsScreenProps = StackScreenProps<RootStackParamList, 'Notifications'>;

const NotificationsScreen: React.FC<NotificationsScreenProps> = () => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notifications Center</Text>
      <Text style={styles.text}>Your notifications will appear here.</Text>
      {/* TODO: Fetch and display actual notifications */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: Colors.light.text,
  },
  text: {
    fontSize: 16,
    color: Colors.light.text,
  },
});

export default NotificationsScreen;
