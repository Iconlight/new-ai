import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Animated, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GiftedChat, Bubble, InputToolbar, Send, IMessage } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import { Appbar, useTheme, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useChat } from '../../../src/contexts/ChatContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import MarkdownText from '../../../components/ui/MarkdownText';
import { useFocusEffect } from '@react-navigation/native';

export default function ChatScreen() {
  const theme = useTheme();
  const { id, opening: openingParam } = useLocalSearchParams<{ id: string; opening?: string }>();
  const { user } = useAuth();
  const { currentChat, messages, loading, selectChat, sendMessage, isTyping } = useChat();
  const [opening, setOpening] = useState(true);
  const suppressOpeningOverlay = openingParam === '1';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Ensure Android hardware back navigates to Discover instead of exiting
  useAndroidBackToDiscover();

  useEffect(() => {
    if (id && user) {
      selectChat(id);
    }
  }, [id, user]);

  // Track readiness: when the desired chat is selected and not loading anymore
  useEffect(() => {
    const ready = currentChat?.id === id && !loading;
    setOpening(!ready);
  }, [id, currentChat?.id, loading]);

  // Animate chat content when opening finishes
  useEffect(() => {
    if (!opening) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [opening]);

  const onSend = (newMessages: IMessage[]) => {
    const message = newMessages[0];
    if (message.text) {
      sendMessage(message.text);
    }
  };

  const renderAvatar = () => null; // Hide avatars for cleaner look

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <Appbar.Header style={styles.glassHeader}>
        <Appbar.BackAction color="#ffffff" onPress={() => {
          // Always navigate to discover page instead of using router.back()
          // This ensures consistent navigation behavior
          router.push('/discover');
        }} />
        <Appbar.Content 
          title={currentChat?.title || 'Chat'} 
          titleStyle={{ color: '#ffffff' }}
        />
      </Appbar.Header>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Loading overlay while opening chat */}
        {opening && !suppressOpeningOverlay && (
          <View style={styles.openingOverlay}>
            <ActivityIndicator animating size="large" color="#C084FC" />
          </View>
        )}
        <Animated.View style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }}>
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{
            _id: user?.id || '1',
            name: user?.full_name || 'You',
          }}
          isTyping={isTyping}
          renderAvatar={renderAvatar}
          placeholder="Type a message..."
          alwaysShowSend
          listViewProps={{
            keyboardShouldPersistTaps: 'always',
          }}
          bottomOffset={Platform.OS === 'ios' ? 0 : 8}
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
              }}
              primaryStyle={{ alignItems: 'center' }}
            />
          )}
          renderSend={(props) => (
            <Send
              {...props}
              containerStyle={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}
            >
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
          textInputStyle={{
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
          }}
          containerStyle={{ backgroundColor: 'transparent' }}
          messagesContainerStyle={{ backgroundColor: 'transparent' }}
          textInputProps={{ placeholderTextColor: 'rgba(255,255,255,0.6)' }}
          renderBubble={(props) => (
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
          )}
          renderMessageText={(props) => {
            const isCurrentUser = props.currentMessage?.user._id === user?.id;
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
        </Animated.View>
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
  },
  chatContainer: {
    flex: 1,
  },
  openingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bubble: {
    borderRadius: 16,
    margin: 4,
    maxWidth: '80%',
    padding: 12,
  },
  bubbleContent: {
    flex: 1,
  },
  messageText: {
    flex: 1,
  },
});

// Handle Android hardware back to ensure we navigate to Discover instead of exiting app
// Placed at the end of the file to keep component definition uncluttered
function useAndroidBackToDiscover() {
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Always navigate to discover page for consistent behavior
        router.push('/discover');
        return true; // we handled it
      };
      if (Platform.OS === 'android') {
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
      }
      return undefined;
    }, [])
  );
}
