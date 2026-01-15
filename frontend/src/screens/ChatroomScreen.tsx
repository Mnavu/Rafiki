import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert, FlatList } from 'react-native';
import { Text } from '@components/Themed';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@navigation/AppNavigator';
import { useAuth } from '@context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '@services/api';
import { ChatMessage, CourseChatroom } from '../types/models';
import Colors from '@theme/Colors';
import { TileButton } from '@components/TileButton';

type ChatroomScreenProps = StackScreenProps<RootStackParamList, 'Chatroom'>;

const ChatroomScreen: React.FC<ChatroomScreenProps> = ({ route }) => {
  const { chatroomId } = route.params;
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState('');

  // Fetch chatroom details
  const { data: chatroom, isLoading: chatroomLoading, error: chatroomError } = useQuery<CourseChatroom>(
    ['chatroom', chatroomId],
    () => API.getChatroom(chatroomId), // Assuming an API endpoint for this
  );

  // Fetch messages
  const { data: messages, isLoading: messagesLoading, error: messagesError } = useQuery<ChatMessage[]>(
    ['chatMessages', chatroomId],
    () => API.getChatMessages(chatroomId), // Assuming an API endpoint for this
    {
      onSuccess: (data) => data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    (message: { chatroom: number; message: string }) => API.postChatMessage(message),
    {
      onSuccess: () => {
        setMessageText('');
        queryClient.invalidateQueries(['chatMessages', chatroomId]); // Refetch messages after sending
      },
      onError: (err) => {
        Alert.alert('Error', 'Failed to send message.');
        console.error('Send message error:', err);
      },
    }
  );

  const handleSendMessage = () => {
    if (messageText.trim() && chatroom) {
      sendMessageMutation.mutate({ chatroom: chatroom.id, message: messageText });
    }
  };

  if (chatroomLoading || messagesLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Chatroom...</Text>
      </View>
    );
  }

  if (chatroomError || messagesError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Error loading chatroom.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{chatroom?.unit?.title || 'Chatroom'}</Text>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.messageBubble, item.author_user.id === state.user?.id ? styles.myMessage : styles.otherMessage]}>
            <Text style={styles.messageAuthor}>{item.author_user.display_name || item.author_user.username}</Text>
            <Text>{item.message}</Text>
            <Text style={styles.messageTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
          </View>
        )}
        style={styles.messageList}
        inverted // Show latest messages at the bottom
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="Type your message..."
          value={messageText}
          onChangeText={setMessageText}
          placeholderTextColor={Colors.gray}
          multiline
        />
        <TileButton title="Send" onPress={handleSendMessage} icon="send" style={styles.sendButton} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: Colors.light.text,
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primaryLight,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.cardBackground,
  },
  messageAuthor: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.gray,
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: Colors.light.border,
  },
  messageInput: {
    flex: 1,
    maxHeight: 100,
    borderColor: Colors.light.text,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    color: Colors.light.text,
  },
  sendButton: {
    minWidth: 80,
    backgroundColor: Colors.primary,
  },
});

export default ChatroomScreen;
