import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Bubble, GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { Appbar, useTheme } from 'react-native-paper';
import MarkdownText from '../../../components/ui/MarkdownText';
import { useAuth } from '../../../src/contexts/AuthContext';
import { getNetworkingConversationInfo, getNetworkingMessages, sendNetworkingMessage } from '../../../src/services/networking';
import { supabase } from '../../../src/services/supabase';

// Hide the native stack header; render our own Appbar.Header and ensure full-screen coverage
export const options = { headerShown: false, presentation: 'fullScreenModal' } as const;

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
    
    // Cleanup: mark messages as read when leaving the chat
    return () => {
      if (conversationId && user?.id) {
        supabase
          .from('networking_messages')
          .update({ is_read: true })
          .eq('conversation_id', String(conversationId))
          .neq('sender_id', user.id)
          .eq('is_read', false)
          .then(() => console.log('[NetworkingChat] Marked remaining messages as read on unmount'))
          .catch(e => console.warn('[NetworkingChat] Failed to mark as read on unmount:', e));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  const init = async () => {
    await Promise.all([loadMessages(), loadHeader()]);
    // Mark all received messages as read on open
    try {
      if (conversationId && user?.id) {
        await supabase
          .from('networking_messages')
          .update({ is_read: true })
          .eq('conversation_id', String(conversationId))
          .neq('sender_id', user.id)
          .eq('is_read', false);
      }
    } catch (e) {
      console.warn('[NetworkingChat] mark read failed:', (e as any)?.message || e);
    }
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
      }, async (payload) => {
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

        // If received from other user, mark as read immediately
        try {
          if (msg.sender_id !== user?.id) {
            await supabase
              .from('networking_messages')
              .update({ is_read: true })
              .eq('id', msg.id)
              .eq('is_read', false);
          }
        } catch {}
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
      colors={["#0B1023", "#2A0E43", "#5B21B6", "#9333EA"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={styles.glassHeaderCard}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Appbar.Header style={styles.glassHeaderInner}>
          <Appbar.BackAction color="#ffffff" onPress={() => router.back()} />
          <Appbar.Content title={otherUserName || 'Networking Chat'} titleStyle={{ color: '#ffffff' }} />
        </Appbar.Header>
      </View>

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
            <View style={styles.inputToolbarWrapper}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
              <InputToolbar
                {...props}
                containerStyle={styles.inputToolbarContainer}
                primaryStyle={{ alignItems: 'center' }}
              />
            </View>
          )}
          renderSend={(props) => (
            <Send {...props} containerStyle={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
              <LinearGradient
                colors={["#8B5CF6", "#EC4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)'
                }}
              >
                <Ionicons name="send" size={18} color="#F5F3FF" />
              </LinearGradient>
            </Send>
          )}
          textInputStyle={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            marginHorizontal: 8,
            borderWidth: 0,
            borderRightWidth: 0,
            borderColor: 'rgba(255,255,255,0.16)',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
          containerStyle={{ backgroundColor: 'transparent' }}
          messagesContainerStyle={{ backgroundColor: 'transparent' }}
          textInputProps={{ placeholderTextColor: 'rgba(255,255,255,0.6)' }}
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
                    backgroundColor: 'rgba(147,51,234,0.22)',
                    borderWidth: 1,
                    borderColor: 'rgba(168,85,247,0.65)',
                    marginVertical: 3,
                    shadowColor: '#8B5CF6',
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 },
                  },
                  left: {
                    backgroundColor: 'rgba(59,130,246,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(96,165,250,0.55)',
                    marginVertical: 3,
                    shadowColor: '#60A5FA',
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                  },
                }}
                containerToNextStyle={{
                  right: { marginBottom: 2 },
                  left: { marginBottom: 2 },
                }}
                containerToPreviousStyle={{
                  right: { marginTop: 2 },
                  left: { marginTop: 2 },
                }}
                textStyle={{
                  right: { color: '#F5F3FF' },
                  left: { color: '#E8ECFF' },
                }}
              />
            );
          }}
          renderMessageText={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) return null; // System messages handled in renderBubble
            
            const isCurrentUser = props.currentMessage?.user?._id === user?.id;
            const textColor = isCurrentUser ? '#F5F3FF' : '#E8ECFF';
            const codeBg = isCurrentUser ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.18)';
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
  decorOrbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  glassHeaderCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  glassHeaderInner: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  orbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -60,
    left: -40,
    opacity: 0.35,
  },
  orbB: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    bottom: -80,
    right: -50,
    opacity: 0.28,
  },
  chatContainer: {
    flex: 1,
  },
  inputToolbarWrapper: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(16,16,24,0.28)',
  },
  inputToolbarContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
});
