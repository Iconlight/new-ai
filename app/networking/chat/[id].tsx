import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Appbar, useTheme } from 'react-native-paper';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { getNetworkingMessages, sendNetworkingMessage, getNetworkingConversationInfo } from '../../../src/services/networking';
import { supabase } from '../../../src/services/supabase';
import MarkdownText from '../../../components/ui/MarkdownText';

export default function NetworkingChatScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id: conversationId, name: routeName } = useLocalSearchParams<{ id: string; name?: string }>();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [otherUserName, setOtherUserName] = useState<string>(
    (typeof routeName === 'string' && routeName.length > 0) ? routeName : 'Networking Chat'
  );

  useEffect(() => {
    if (conversationId && user) {
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  const init = async () => {
    await Promise.all([loadMessages(), loadHeader()]);
    subscribeToMessages();
  };

  const loadHeader = async () => {
    if (!conversationId || !user) return;
    console.log('Loading header for conversation:', conversationId);
    const info = await getNetworkingConversationInfo(conversationId, user.id);
    console.log('Conversation info:', info);
    if (info?.otherUserName && (!routeName || routeName.length === 0)) {
      setOtherUserName(info.otherUserName);
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      const { messages: networkingMessages } = await getNetworkingMessages(conversationId);

      const giftedMessages: IMessage[] = networkingMessages.map((msg: any) => {
        const isSystem = msg.message_type === 'system' || msg.message_type === 'starter';
        if (isSystem) {
          return {
            _id: msg.id,
            text: msg.content,
            createdAt: new Date(msg.created_at),
            system: true,
            user: { _id: 'system' }, // Required by IMessage interface
          } as IMessage;
        }
        return {
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_id === user?.id ? 'You' : otherUserName,
          },
        } as IMessage;
      }).reverse();

      setMessages(giftedMessages);
    } catch (error) {
      console.error('Error loading networking messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`rt-networking-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'networking_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg: any = payload.new;
        const isSystem = msg.message_type === 'system' || msg.message_type === 'starter';
        const gifted: IMessage = isSystem ? {
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          system: true,
          user: { _id: 'system' }, // Required by IMessage interface
        } : {
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_id === user?.id ? 'You' : otherUserName,
          },
        };
        setMessages(prev => GiftedChat.append(prev, [gifted]));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <Appbar.Content title={otherUserName || 'Networking Chat'} />
      </Appbar.Header>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{
            _id: user?.id || '',
          }}
          renderAvatar={() => null}
          placeholder="Type your message..."
          alwaysShowSend
          textInputStyle={{
            backgroundColor: theme.colors.surface,
            color: theme.colors.onSurface,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 8,
            marginHorizontal: 8,
          }}
          containerStyle={{
            backgroundColor: theme.colors.background,
          }}
          messagesContainerStyle={{
            backgroundColor: theme.colors.background,
          }}
          renderBubble={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) {
              return (
                <View style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  padding: 12,
                  marginHorizontal: 16,
                  marginVertical: 8,
                  borderRadius: 12,
                  alignSelf: 'center',
                  maxWidth: '90%',
                }}>
                  <MarkdownText
                    text={props.currentMessage?.text || ''}
                    color={theme.colors.onSurface}
                    codeBg={theme.colors.surface}
                    codeColor={theme.colors.onSurface}
                  />
                </View>
              );
            }
            return (
              <Bubble
                {...props}
                wrapperStyle={{
                  right: { backgroundColor: theme.colors.primary },
                  left: { backgroundColor: theme.colors.surfaceVariant },
                }}
                textStyle={{
                  right: { color: theme.colors.onPrimary },
                  left: { color: theme.colors.onSurface },
                }}
              />
            );
          }}
          renderMessageText={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) return null; // System messages handled in renderBubble
            
            const isCurrentUser = props.currentMessage?.user?._id === user?.id;
            const textColor = isCurrentUser ? theme.colors.onPrimary : theme.colors.onSurface;
            const codeBg = isCurrentUser ? 'rgba(255,255,255,0.15)' : theme.colors.surface;
            return (
              <View style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                <MarkdownText
                  text={props.currentMessage?.text || ''}
                  color={textColor}
                  codeBg={codeBg}
                  codeColor={textColor}
                />
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
});
