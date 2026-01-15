import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useAuth } from '@context/AuthContext';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';

export const WebDrawerContent = (props: any) => {
    const { logout } = useAuth();

    return (
        <DrawerContentScrollView {...props}>
            <DrawerItemList {...props} />
            <View style={styles.logoutButton}>
                <Button title="Logout" onPress={logout} color="red" />
            </View>
        </DrawerContentScrollView>
    );
};

const styles = StyleSheet.create({
    logoutButton: {
        marginTop: 20,
        marginHorizontal: 10,
    },
});
