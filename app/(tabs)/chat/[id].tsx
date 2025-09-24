import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { GiftedChat, Bubble, MessageText, IMessage } from 'react-native-gifted-chat';
import { Appbar, useTheme, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useChat } from '../../../src/contexts/ChatContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import MarkdownText from '../../../components/ui/MarkdownText';

export default function ChatScreen() {
  const theme = useTheme();
  const { id, opening: openingParam } = useLocalSearchParams<{ id: string; opening?: string }>();
  const { user } = useAuth();
  const { currentChat, messages, loading, selectChat, sendMessage, isTyping } = useChat();
  const [opening, setOpening] = useState(true);
  const suppressOpeningOverlay = openingParam === '1';
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content 
          title={currentChat?.title || 'Chat'} 
          titleStyle={{ color: theme.colors.onSurface }}
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
            <ActivityIndicator animating size="large" color={theme.colors.primary} />
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
          renderBubble={(props) => (
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
          )}
          renderMessageText={(props) => {
            const isCurrentUser = props.currentMessage?.user._id === user?.id;
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
        </Animated.View>
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
