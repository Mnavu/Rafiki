import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, Linking, Alert } from 'react-native';
import { useAuth } from '@context/AuthContext';
import { ApiUser, createStudentDirectMessage } from '@services/api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/AppNavigator';

const fetchLecturers = async (token: string): Promise<ApiUser[]> => {
    const response = await fetch('http://127.0.0.1:8000/api/learning/my-lecturers/', {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch lecturers');
    }
    return response.json();
};

export const StudentCommunicateScreen = () => {
    const { state } = useAuth();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [lecturers, setLecturers] = useState<ApiUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (state.accessToken) {
            fetchLecturers(state.accessToken)
                .then(setLecturers)
                .catch(_err => Alert.alert('Error', 'Could not load lecturers.'))
                .finally(() => setLoading(false));
        }
    }, [state.accessToken]);

    const handleCall = (lecturer: ApiUser) => {
        if (lecturer.phone) {
            Linking.openURL(`tel:${lecturer.phone}`);
        } else {
            Alert.alert('No Phone Number', 'This lecturer has not provided a phone number.');
        }
    };

    const handleVoiceNote = async (lecturer: ApiUser) => {
        if (!state.accessToken || !state.user) {return;}
        try {
            const thread = await createStudentDirectMessage(state.accessToken, lecturer.id);
            navigation.navigate('LecturerMessages', { threadId: thread.id });
        } catch (error) {
            Alert.alert('Error', 'Could not start a conversation.');
        }
    };

    const renderLecturer = ({ item }: { item: ApiUser }) => (
        <View style={styles.lecturerContainer}>
            <Text style={styles.lecturerName}>{item.display_name || item.username}</Text>
            <View style={styles.buttonsContainer}>
                <Button title="Call" onPress={() => handleCall(item)} />
                <Button title="Voice Note" onPress={() => handleVoiceNote(item)} />
            </View>
        </View>
    );

    if (loading) {
        return <View style={styles.container}><Text>Loading...</Text></View>;
    }

    return (
        <FlatList
            data={lecturers}
            renderItem={renderLecturer}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.container}
            ListHeaderComponent={<Text style={styles.title}>Contact Your Lecturers</Text>}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    lecturerContainer: {
        padding: 15,
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
    },
    lecturerName: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 10,
    },
});
