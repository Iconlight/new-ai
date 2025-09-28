import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bubble, GiftedChat, InputToolbar, Send, Composer, IMessage } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import { Appbar, useTheme } from 'react-native-paper';
import MarkdownText from '../../../components/ui/MarkdownText';
import { useAuth } from '../../../src/contexts/AuthContext';
import { getNetworkingConversationInfo, getNetworkingMessages, sendNetworkingMessage } from '../../../src/services/networking';
import { supabase } from '../../../src/services/supabase';

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
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <Appbar.Header style={styles.glassHeader}>
        <Appbar.BackAction color="#ffffff" onPress={() => router.back()} />
        <Appbar.Content title={otherUserName || 'Networking Chat'} titleStyle={{ color: '#ffffff' }} />
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
          renderInputToolbar={(props) => (
            <InputToolbar
              {...props}
              containerStyle={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderTopWidth: 0,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                marginHorizontal: 8,
                marginBottom: 8,
                borderRadius: 16,
                overflow: 'hidden',
              }}
              primaryStyle={{ alignItems: 'center' }}
            />
          )}
          renderComposer={(props) => (
            <Composer
              {...props}
              textInputStyle={{
                ...(props.textInputStyle as any),
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
              }}
            />
          )}
          renderSend={(props) => (
            <Send {...props} containerStyle={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: 'rgba(192,132,252,0.22)',
                  borderWidth: 1,
                  borderColor: 'rgba(192,132,252,0.55)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 6,
                }}
              >
                <Ionicons name="send" size={18} color="#E9D5FF" />
              </View>
            </Send>
          )}
          messagesContainerStyle={{ backgroundColor: 'transparent' }}
          textInputProps={{
            placeholderTextColor: 'rgba(255,255,255,0.6)',
            style: {
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              marginHorizontal: 8,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
          }}
          renderBubble={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) {
              return (
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                  padding: 12,
                  marginHorizontal: 16,
                  marginVertical: 8,
                  borderRadius: 12,
                  alignSelf: 'center',
                  maxWidth: '90%',
                }}>
                  <MarkdownText
                    text={props.currentMessage?.text || ''}
                    color={'#EDE9FE'}
                    codeBg={'rgba(255,255,255,0.08)'}
                    codeColor={'#EDE9FE'}
                  />
                </View>
              );
            }
            return (
              <Bubble
                {...props}
                wrapperStyle={{
                  right: {
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                  },
                  left: {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                  },
                }}
                textStyle={{
                  right: { color: '#ffffff' },
                  left: { color: '#EDE9FE' },
                }}
              />
            );
          }}
          renderMessageText={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) return null; // System messages handled in renderBubble
            
            const isCurrentUser = props.currentMessage?.user?._id === user?.id;
            const textColor = isCurrentUser ? '#ffffff' : '#EDE9FE';
            const codeBg = isCurrentUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  glassHeader: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  chatContainer: {
    flex: 1,
  },
});
