import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Appbar, useTheme } from 'react-native-paper';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { getNetworkingMessages, sendNetworkingMessage } from '../../../src/services/networking';

export default function NetworkingChatScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversationId && user) {
      loadMessages();
    }
  }, [conversationId, user]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      const { messages: networkingMessages } = await getNetworkingMessages(conversationId);
      
      const giftedMessages: IMessage[] = networkingMessages.map((msg: any) => ({
        _id: msg.id,
        text: msg.content,
        createdAt: new Date(msg.created_at),
        user: {
          _id: msg.sender_id,
          name: msg.sender_id === user?.id ? 'You' : 'Connection',
          avatar: msg.sender_id === user?.id ? undefined : '👤',
        },
      })).reverse();

      setMessages(giftedMessages);
    } catch (error) {
      console.error('Error loading networking messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSend = async (newMessages: IMessage[] = []) => {
    if (!conversationId || !user) return;

    const message = newMessages[0];
    if (!message?.text) return;

    // Optimistically add message to UI
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));

    try {
      await sendNetworkingMessage(conversationId, user.id, message.text);
    } catch (error) {
      console.error('Error sending networking message:', error);
      // Could implement retry logic or error handling here
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Networking Chat" />
      </Appbar.Header>

      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: user?.id || '',
        }}
        renderAvatar={null}
        showUserAvatar={false}
        placeholder="Type your message..."
        alwaysShowSend
        scrollToBottom
        theme={{
          ...theme,
          colors: {
            ...theme.colors,
            primary: theme.colors.primary,
            inputBackground: theme.colors.surfaceVariant,
            background: theme.colors.background,
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
