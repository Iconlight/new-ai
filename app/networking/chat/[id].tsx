import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bubble, GiftedChat, IMessage, InputToolbar, Send, Message } from 'react-native-gifted-chat';
import * as Notifications from 'expo-notifications';
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

  const unsubscribeRef = useRef<() => void>(() => {});

  // Merge helper to preserve all history, de-duplicate by _id, and keep newest-first
  const mergeMessages = (prev: IMessage[], incoming: IMessage | IMessage[]): IMessage[] => {
    const add = Array.isArray(incoming) ? incoming : [incoming];
    const map = new Map<string | number, IMessage>();
    // seed with prev
    for (const m of prev) map.set(m._id as any, m);
    // add/overwrite with incoming
    for (const m of add) map.set(m._id as any, m);
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
    console.log('[NetworkingChat] mergeMessages: prev count:', prev.length, 'incoming count:', add.length, 'result count:', arr.length);
    return arr;
  };

  // Subscribe to realtime and initialize data when the conversation or user changes
  useEffect(() => {
    if (!conversationId || !user) return;

    // Start realtime first to catch UPDATE events triggered by mark-as-read
    const unsubscribe = subscribeToMessages();
    unsubscribeRef.current = unsubscribe;

    // Then load messages/header and mark-as-read
    init();

    // Cleanup: unsubscribe and mark messages as read when leaving the chat
    return () => {
      try { unsubscribe(); } catch {}
      if (conversationId && user?.id) {
        (async () => {
          try {
            await supabase
              .from('networking_messages')
              .update({ is_read: true })
              .eq('conversation_id', String(conversationId))
              .neq('sender_id', user.id)
              .eq('is_read', false);
            console.log('[NetworkingChat] Marked remaining messages as read on unmount');
          } catch (err) {
            console.warn('[NetworkingChat] Failed to mark as read on unmount:', (err as any)?.message || err);
          }
        })();
      }
    };
  }, [conversationId, user?.id]);

  // Ensure Android notification channel exists (no-op on iOS/web)
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5CF6',
          });
        }
      } catch (e) {
        console.warn('[NetworkingChat] Failed to set Android channel', (e as any)?.message || e);
      }
    })();
  }, []);

  // Debug: Log messages state changes
  useEffect(() => {
    console.log('[NetworkingChat] 📊 Messages state updated, count:', messages.length);
    if (messages.length > 0) {
      console.log('[NetworkingChat] 📊 Newest message:', messages[0]._id, messages[0].text?.substring(0, 30));
      console.log('[NetworkingChat] 📊 Oldest message:', messages[messages.length - 1]._id, messages[messages.length - 1].text?.substring(0, 30));
    }
  }, [messages.length]);

  // Web fallback: poll for new messages every 3s when on web platform
  useEffect(() => {
    if (!conversationId || !user) return;
    if (Platform.OS !== 'web') return;
    let timer: any;
    let mounted = true;
    const seen = new Set<string>();
    
    const poll = async () => {
      try {
        const { messages: list } = await getNetworkingMessages(conversationId as string);
        if (!mounted) return;
        const newOnes = list.filter((m: any) => !seen.has(String(m.id)));
        if (newOnes.length) {
          const mapped: IMessage[] = newOnes.map((msg: any) => ({
            _id: msg.id,
            text: msg.content,
            createdAt: new Date(msg.created_at),
            user: { _id: msg.sender_id, name: msg.sender_id === user.id ? 'You' : otherUserName },
            sent: msg.sender_id === user.id ? true : undefined,
            received: msg.sender_id === user.id ? Boolean(msg.is_read) : undefined,
          }));
          setMessages(prev => {
            // Add current message IDs to seen set
            prev.forEach(m => seen.add(String(m._id)));
            return mergeMessages(prev, mapped);
          });
          newOnes.forEach((m: any) => seen.add(String(m.id)));
        } else {
          // Even if no new messages, update the seen set with current messages
          setMessages(prev => {
            prev.forEach(m => seen.add(String(m._id)));
            return prev;
          });
        }
      } catch {}
    };
    
    timer = setInterval(poll, 3000);
    // immediate first poll
    poll();
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [conversationId, user?.id, Platform.OS, otherUserName]);

  const init = async () => {
    await Promise.all([loadMessages(), loadHeader()]);
    // Then mark all received messages as read (this will trigger UPDATE events)
    try {
      if (conversationId && user?.id) {
        console.log('[NetworkingChat] Marking messages as read for conversation:', conversationId);
        
        const { data, error } = await supabase
          .from('networking_messages')
          .update({ is_read: true })
          .eq('conversation_id', String(conversationId))
          .neq('sender_id', user.id)
          .eq('is_read', false)
          .select();
        
        if (error) {
          console.error('[NetworkingChat] Error marking as read:', error);
        } else {
          console.log(`[NetworkingChat] Marked ${data?.length || 0} messages as read`);
        }
      }
    } catch (e) {
      console.warn('[NetworkingChat] mark read failed:', (e as any)?.message || e);
    }
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
      console.log('[NetworkingChat] loadMessages: fetched', networkingMessages.length, 'messages from database');

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
        const isOutgoing = msg.sender_id === user?.id;
        return {
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_id === user?.id ? 'You' : otherUserName,
          },
          // Ticks: mark sent for our messages; mark received if the other user has read it
          sent: isOutgoing ? true : undefined,
          received: isOutgoing ? Boolean(msg.is_read) : undefined,
        } as IMessage;
      });

      // Sort messages newest-first to match GiftedChat's inverted={true} expectation
      giftedMessages.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

      console.log('[NetworkingChat] loadMessages: setting', giftedMessages.length, 'messages to state');
      console.log('[NetworkingChat] First 3 message IDs:', giftedMessages.slice(0, 3).map(m => m._id));
      console.log('[NetworkingChat] Last 3 message IDs:', giftedMessages.slice(-3).map(m => m._id));
      setMessages(giftedMessages);
    } catch (error) {
      console.error('Error loading networking messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = (): () => void => {
    if (!conversationId) return () => {};
    console.log('[NetworkingChat] Subscribing to realtime for conversation:', conversationId);
    const channel = supabase
      .channel(`rt-networking-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'networking_messages',
        filter: `conversation_id=eq.${String(conversationId)}`,
      }, async (payload) => {
        const msg: any = payload.new;
        console.log('[NetworkingChat] INSERT message event:', msg?.id);
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
          sent: msg.sender_id === user?.id ? true : undefined,
        };
        setMessages(prev => mergeMessages(prev, gifted));

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

        // Schedule a local notification for incoming messages (app must be running)
        // Note: Remote push (when app is closed) is handled by Edge Function
        try {
          if (msg.sender_id !== user?.id && Platform.OS !== 'web') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `💬 ${otherUserName || 'New message'}`,
                body: (msg.content || '').slice(0, 140),
                data: {
                  type: 'networking_message',
                  conversationId: String(conversationId),
                  senderName: otherUserName,
                },
                sound: 'default',
                ...(Platform.OS === 'android' && {
                  color: '#8B5CF6',
                }),
              },
              // null triggers immediately; uses 'default' channel on Android
              trigger: null as any,
            });
          }
        } catch (e) {
          console.warn('[NetworkingChat] Failed to schedule local notification', (e as any)?.message || e);
        }
      })
      // Listen for read status updates to update ticks on our sent messages
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'networking_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg: any = payload.new;
        console.log('[NetworkingChat] UPDATE message event:', msg?.id, 'is_read:', msg?.is_read);
        if (msg.sender_id === user?.id && msg.is_read) {
          setMessages(prev => prev.map(m => m._id === msg.id ? { ...m, received: true } : m));
        }
      })
      .subscribe((status) => {
        console.log('[NetworkingChat] Channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const onSend = async (newMessages: IMessage[] = []) => {
    if (!conversationId || !user) return;

    const message = newMessages[0];
    if (!message?.text) return;

    // Don't add optimistically - let realtime handle it to avoid duplicates
    // The message will appear when the INSERT event fires
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
      {/* Floating Header */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>{otherUserName || 'Networking Chat'}</Text>
        <View style={{ width: 44 }} />
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
          showUserAvatar={false}
          renderAvatarOnTop={false}
          placeholder="Type your message..."
          alwaysShowSend
          infiniteScroll={true}
          loadEarlier={false}
          isLoadingEarlier={false}
          inverted={true}
          messagesContainerStyle={{ paddingHorizontal: 0, alignItems: 'stretch' }}
          // Render our own full-width row with Bubble to eliminate default avatar gutter/indentation
          renderMessage={(props) => {
            const isSystem = (props.currentMessage as any)?.system === true;
            if (isSystem) {
              return (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={{
                    alignSelf: 'center',
                    marginVertical: 12,
                    marginHorizontal: 16,
                    maxWidth: '90%',
                  }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.18)',
                        borderRadius: 16,
                        padding: 14,
                        overflow: 'hidden',
                        shadowColor: '#8B5CF6',
                        shadowOpacity: 0.35,
                        shadowRadius: 14,
                        shadowOffset: { width: 0, height: 6 },
                      }}
                    >
                      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
                      <MarkdownText
                        text={props.currentMessage?.text || ''}
                        color={'#FFFFFF'}
                        codeBg={'rgba(255,255,255,0.14)'}
                        codeColor={'#FFFFFF'}
                      />
                    </View>
                  </View>
                </View>
              );
            }
            const isRight = props.position === 'right';
            const isCurrentUser = props.currentMessage?.user?._id === user?.id;
            const textColor = isCurrentUser ? '#F5F3FF' : '#E8ECFF';
            const codeBg = isCurrentUser ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.18)';
            
            // Format timestamp
            const messageTime = props.currentMessage?.createdAt;
            const timeString = messageTime 
              ? new Date(messageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            
            return (
              <View style={{ flex: 1, alignSelf: 'stretch', width: '100%', flexDirection: 'row', justifyContent: isRight ? 'flex-end' : 'flex-start', paddingHorizontal: 12 }}>
                <View style={{
                  maxWidth: '80%',
                  backgroundColor: isRight ? 'rgba(147,51,234,0.22)' : 'rgba(59,130,246,0.18)',
                  borderWidth: 1,
                  borderColor: isRight ? 'rgba(168,85,247,0.65)' : 'rgba(96,165,250,0.55)',
                  marginVertical: 3,
                  paddingVertical: 2,
                  paddingHorizontal: 2,
                  borderRadius: 16,
                  alignSelf: isRight ? 'flex-end' : 'flex-start',
                  shadowColor: isRight ? '#8B5CF6' : '#60A5FA',
                  shadowOpacity: isRight ? 0.35 : 0.25,
                  shadowRadius: isRight ? 10 : 8,
                  shadowOffset: { width: 0, height: isRight ? 3 : 2 },
                }}>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                    <MarkdownText text={props.currentMessage?.text || ''} color={textColor} codeBg={codeBg} codeColor={textColor} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 2, paddingTop: 2 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                      {timeString}
                    </Text>
                    {isCurrentUser ? (
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginLeft: 6 }}>
                        {props.currentMessage?.received ? '✓✓' : props.currentMessage?.sent ? '✓' : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          // (Removed renderBubble override; we fully control layout in renderMessage)
          textInputProps={{
            placeholderTextColor: 'rgba(255,255,255,0.7)',
            style: {
              flex: 1,
              backgroundColor: 'transparent',
              color: '#ffffff',
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              marginHorizontal: 0,
              borderWidth: 0,
            },
          }}
          minComposerHeight={44}
          maxComposerHeight={100}
          listViewProps={{ 
            keyboardShouldPersistTaps: 'always',
            scrollEnabled: true,
            nestedScrollEnabled: true,
            // Improve web scrolling behavior
            style: { minHeight: 0 },
            contentContainerStyle: { flexGrow: 1, paddingVertical: 6, paddingHorizontal: 0, alignItems: 'stretch' },
          } as any}
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
            <Send {...props} containerStyle={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 8,
                }}
              >
                <Ionicons name="send" size={22} color="#FFFFFF" />
              </View>
            </Send>
          )}
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
    // Important for web: allow children to determine their own scrollable height
    // Without minHeight: 0, nested Flex containers can prevent scrolling
    minHeight: 0,
  },
  decorOrbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 52,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
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
    backgroundColor: 'transparent',
    // Important for web scrolling
    minHeight: 0,
  },
  inputToolbarWrapper: {
    marginHorizontal: 12,
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
