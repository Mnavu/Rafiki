import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '@context/AuthContext';

export const BiometricLockScreen = () => {
  const { unlockWithBiometrics, logout } = useAuth();

  const handleUnlock = async () => {
    const success = await unlockWithBiometrics();
    if (!success) {
      // Maybe show an error message
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduAssist is Locked</Text>
      <Text style={styles.subtitle}>Please unlock to continue.</Text>
      <View style={styles.buttonContainer}>
        <Button title="Unlock with Biometrics" onPress={handleUnlock} />
      </View>
      <View style={styles.buttonContainer}>
        <Button title="Log Out" onPress={logout} color="red" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 30,
  },
  buttonContainer: {
    marginTop: 10,
    width: '80%',
  },
});
