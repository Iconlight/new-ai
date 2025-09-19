import React, { useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { GiftedChat, Bubble, IMessage } from 'react-native-gifted-chat';
import { Appbar, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useChat } from '../../src/contexts/ChatContext';
import { useAuth } from '../../src/contexts/AuthContext';
import MarkdownText from '../../components/ui/MarkdownText';

export default function ChatScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { currentChat, messages, loading, selectChat, sendMessage, isTyping } = useChat();

  useEffect(() => {
    if (id && user) {
      selectChat(id);
    }
  }, [id, user]);

  const onSend = (newMessages: IMessage[]) => {
    if (newMessages.length > 0) {
      sendMessage(newMessages[0].text);
    }
  };

  const renderAvatar = () => null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="Loading..." />
        </Appbar.Header>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={currentChat?.title || 'Chat'} />
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
