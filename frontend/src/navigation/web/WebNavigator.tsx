import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '@context/AuthContext';

import { AdminDashboardScreen, HodDashboardScreen, RoleSelectionScreen } from '@screens/index';
import { WebDrawerContent } from './WebDrawerContent';

const Drawer = createDrawerNavigator();

export const WebNavigator = () => {
    const { state } = useAuth();
    const user = state.user;

    if (!user) {
        return (
            <NavigationContainer>
                <Drawer.Navigator>
                    <Drawer.Screen name="Login" component={RoleSelectionScreen} />
                </Drawer.Navigator>
            </NavigationContainer>
        );
    }

    return (
        <NavigationContainer>
            <Drawer.Navigator drawerContent={(props) => <WebDrawerContent {...props} />}>
                {user.role === 'admin' && (
                    <Drawer.Screen name="Admin Dashboard" component={AdminDashboardScreen} />
                )}
                {user.role === 'hod' && (
                    <Drawer.Screen name="HOD Dashboard" component={HodDashboardScreen} />
                )}
                {/* Add other screens for admin/hod roles here */}
            </Drawer.Navigator>
        </NavigationContainer>
    );
};
