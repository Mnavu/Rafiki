import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@context/AuthContext';

import { AdminDashboardScreen, HodDashboardScreen, RoleSelectionScreen, LoginScreen } from '@screens/index';
import { WebDrawerContent } from './WebDrawerContent';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const AppDrawer = () => {
    const { state } = useAuth();
    const user = state.user;

    return (
        <Drawer.Navigator drawerContent={WebDrawerContent}>
            {user?.role === 'admin' && (
                <Drawer.Screen name="Admin Dashboard" component={AdminDashboardScreen} />
            )}
            {user?.role === 'hod' && (
                <Drawer.Screen name="HOD Dashboard" component={HodDashboardScreen} />
            )}
            {/* Add other screens for admin/hod roles here */}
        </Drawer.Navigator>
    );
};

export const WebNavigator = () => {
    const { isAuthenticated } = useAuth();

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isAuthenticated ? (
                    <Stack.Screen name="AppDrawer" component={AppDrawer} />
                ) : (
                    <>
                        <Stack.Screen name="RoleSelection">
                            {({ navigation }) => (
                                <RoleSelectionScreen onSelectRole={(role) => navigation.navigate('Login', { role })} />
                            )}
                        </Stack.Screen>
                        <Stack.Screen name="Login">
                            {({ route }) => <LoginScreen role={route.params.role} />}
                        </Stack.Screen>
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};
