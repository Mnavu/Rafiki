import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@context/AuthContext';
import { Quiz, Question, Choice } from '../../types/models'; // Assuming types are defined

const fetchQuiz = async (quizId: number, token: string): Promise<Quiz> => {
    const response = await fetch(`http://127.0.0.1:8000/api/learning/quizzes/${quizId}/`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch quiz');
    }
    return response.json();
};

const submitQuiz = async (quizId: number, answers: { question: number, choice: number }[], token: string) => {
    const response = await fetch(`http://127.0.0.1:8000/api/learning/quizzes/${quizId}/submit_answers/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
    });
    if (!response.ok) {
        throw new Error('Failed to submit quiz');
    }
    return response.json();
};

export const QuizScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { state } = useAuth();
    const { quizId } = route.params as { quizId: number };

    const { data: quiz, isLoading } = useQuery(['quiz', quizId], () => fetchQuiz(quizId, state.accessToken || ''));

    const [answers, setAnswers] = useState<{ [key: number]: number }>({});

    const mutation = useMutation(submitQuiz, {
        onSuccess: (data) => {
            navigation.navigate('QuizResult', { score: data.score });
        },
        onError: () => {
            Alert.alert("Error", "Could not submit your answers.");
        }
    });

    const handleSelectChoice = (questionId: number, choiceId: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
    };

    const handleSubmit = () => {
        const formattedAnswers = Object.entries(answers).map(([question, choice]) => ({ question: parseInt(question), choice }));
        mutation.mutate({ quizId, answers: formattedAnswers, token: state.accessToken || '' });
    };

    if (isLoading || !quiz) {
        return <View style={styles.container}><Text>Loading Quiz...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{quiz.title}</Text>
            <FlatList
                data={quiz.questions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item: question }) => (
                    <View style={styles.questionContainer}>
                        <Text style={styles.questionText}>{question.text}</Text>
                        {question.choices.map(choice => (
                            <TouchableOpacity
                                key={choice.id}
                                style={[styles.choice, answers[question.id] === choice.id && styles.selectedChoice]}
                                onPress={() => handleSelectChoice(question.id, choice.id)}
                            >
                                <Text>{choice.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            />
            <Button title="Submit" onPress={handleSubmit} disabled={mutation.isLoading} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    questionContainer: { marginBottom: 20 },
    questionText: { fontSize: 18, marginBottom: 10 },
    choice: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 5 },
    selectedChoice: { backgroundColor: '#d0e0ff' }
});

