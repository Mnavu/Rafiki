import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

export const QuizResultScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { score } = route.params as { score: number };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Quiz Complete!</Text>
            <Text style={styles.scoreText}>Your score:</Text>
            <Text style={styles.score}>{score.toFixed(2)}%</Text>
            <Button title="Back to Library" onPress={() => navigation.navigate('Library')} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    scoreText: {
        fontSize: 18,
    },
    score: {
        fontSize: 48,
        fontWeight: 'bold',
        marginVertical: 20,
    }
});
