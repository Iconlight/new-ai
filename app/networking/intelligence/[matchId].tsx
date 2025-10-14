import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { GiftedChat, IMessage, Bubble, InputToolbar, Send } from 'react-native-gifted-chat';
import { Appbar, Text } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { 
  getOrCreateIntelligenceChat, 
  askAboutUser, 
  getIntelligenceChatMessages 
} from '../../../src/services/networkingIntelligence';
import { useAuth } from '../../../src/contexts/AuthContext';
import { supabase } from '../../../src/services/supabase';

export default function IntelligenceChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (matchId && user) {
      loadChat();
    }
  }, [matchId, user]);

  const loadChat = async () => {
    if (!user || !matchId) return;

    try {
      setLoading(true);

      // Get match details to find target user
      const { data: match, error: matchError } = await supabase
        .from('user_matches')
        .select('user_id_1, user_id_2')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        console.error('Error loading match:', matchError);
        return;
      }

      const targetUserId = match.user_id_1 === user.id 
        ? match.user_id_2 
        : match.user_id_1;

      // Get target user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', targetUserId)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        return;
      }

      const targetUserData = {
        id: targetUserId,
        name: profile?.full_name || 'User',
        avatar: profile?.avatar_url
      };

      setTargetUser(targetUserData);

      // Get or create intelligence chat
      const id = await getOrCreateIntelligenceChat(
        user.id, 
        targetUserId, 
        matchId,
        targetUserData.name
      );
      setChatId(id);

      // Load messages
      const chatMessages = await getIntelligenceChatMessages(id);
      const formattedMessages = chatMessages
        .map((msg, index) => ({
          _id: `${index}-${msg.timestamp}`,
          text: msg.content,
          createdAt: new Date(msg.timestamp),
          user: {
            _id: msg.role === 'user' ? user.id : 'ai',
            name: msg.role === 'user' ? 'You' : 'AI Assistant',
            avatar: msg.role === 'assistant' ? '🤖' : undefined
          }
        }))
        .reverse();

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading intelligence chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (!chatId || !user || !targetUser || newMessages.length === 0) return;

    const userMessage = newMessages[0];
    
    // Add user message immediately
    setMessages(previousMessages => 
      GiftedChat.append(previousMessages, newMessages)
    );
    
    setIsTyping(true);

    try {
      const response = await askAboutUser(
        chatId,
        user.id,
        targetUser.id,
        userMessage.text
      );

      const aiMessage: IMessage = {
        _id: Math.random().toString(),
        text: response,
        createdAt: new Date(),
        user: {
          _id: 'ai',
          name: 'AI Assistant',
          avatar: '🤖'
        }
      };

      setMessages(previousMessages => 
        GiftedChat.append(previousMessages, [aiMessage])
      );
    } catch (error) {
      console.error('Error asking AI:', error);
      
      const errorMessage: IMessage = {
        _id: Math.random().toString(),
        text: "Sorry, I'm having trouble processing that question. Please try again.",
        createdAt: new Date(),
        user: {
          _id: 'ai',
          name: 'AI Assistant',
          avatar: '🤖'
        }
      };

      setMessages(previousMessages => 
        GiftedChat.append(previousMessages, [errorMessage])
      );
    } finally {
      setIsTyping(false);
    }
  }, [chatId, user, targetUser]);

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          left: {
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          },
          right: {
            backgroundColor: '#7C3AED',
          }
        }}
        textStyle={{
          left: { color: '#ffffff' },
          right: { color: '#ffffff' }
        }}
      />
    );
  };

  const renderInputToolbar = (props: any) => {
    return (
      <View style={styles.inputToolbarWrapper}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <InputToolbar
          {...props}
          containerStyle={styles.inputToolbar}
          primaryStyle={styles.inputPrimary}
        />
      </View>
    );
  };

  const renderSend = (props: any) => {
    return (
      <Send {...props} containerStyle={styles.sendContainer}>
        <View style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#7C3AED" />
        </View>
      </Send>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Appbar.Header style={styles.appbar}>
            <Appbar.BackAction color="#fff" onPress={() => router.back()} />
            <Appbar.Content 
              title="Loading..."
              titleStyle={{ color: '#fff' }}
            />
          </Appbar.Header>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction color="#fff" onPress={() => router.back()} />
          <Appbar.Content 
            title={`Ask About ${targetUser?.name || 'User'}`}
            subtitle="AI-powered insights"
            titleStyle={{ color: '#fff', fontSize: 18 }}
            subtitleStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}
          />
        </Appbar.Header>
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <GiftedChat
          messages={messages}
          onSend={messages => onSend(messages)}
          user={{
            _id: user?.id || '1',
            name: user?.full_name || 'You',
          }}
          isTyping={isTyping}
          placeholder="Ask about their interests, perspectives..."
          alwaysShowSend
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          messagesContainerStyle={styles.messagesContainer}
          textInputStyle={styles.textInput}
          listViewProps={{
            style: { backgroundColor: 'transparent' }
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
  header: {
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  appbar: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    backgroundColor: 'transparent',
  },
  inputToolbarWrapper: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  inputToolbar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  textInput: {
    color: '#ffffff',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
    fontSize: 16,
  },
});
