import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleSelectionScreen } from '@screens/auth/RoleSelectionScreen';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { RoleDashboardScreen } from '@screens/dashboard/RoleDashboardScreen';
import { useAuth } from '@context/AuthContext';
import type { Role } from '@types/roles';

export type RootStackParamList = {
  RoleSelection: undefined;
  Login: { role: Role };
  Dashboard: { role: Role };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, state } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && state.user ? (
          <Stack.Screen name="Dashboard" component={RoleDashboardScreen} initialParams={{ role: state.user.role }} />
        ) : (
          <>
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
