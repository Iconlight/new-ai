import React, { useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, BackHandler, Text, TouchableOpacity } from 'react-native';
import { GiftedChat, Bubble, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { Appbar, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useChat } from '../../src/contexts/ChatContext';
import { useAuth } from '../../src/contexts/AuthContext';
import MarkdownText from '../../components/ui/MarkdownText';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { currentChat, messages, loading, selectChat, sendMessage, isTyping } = useChat();

  // Ensure Android hardware back navigates to Discover instead of exiting
  useAndroidBackToDiscover();

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
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/discover');
              }
            }}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Loading...</Text>
          <View style={{ width: 44 }} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      {/* Floating Header */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            }
          }}
          style={styles.headerButton}
        >
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>{currentChat?.title || 'Chat'}</Text>
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
          renderInputToolbar={(props) => (
            <View style={styles.inputToolbarWrapper}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
              <InputToolbar
                {...props}
                containerStyle={{ backgroundColor: 'transparent', borderTopWidth: 0 }}
                primaryStyle={{ alignItems: 'center' }}
              />
            </View>
          )}
          renderSend={(props) => (
            <Send {...props} containerStyle={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 6,
                }}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </View>
            </Send>
          )}
          textInputProps={{
            placeholderTextColor: 'rgba(255,255,255,0.7)',
            style: {
              flex: 1,
              backgroundColor: 'transparent',
              color: '#ffffff',
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 8,
              marginHorizontal: 0,
              borderWidth: 0,
            },
          }}
          containerStyle={{ backgroundColor: 'transparent' }}
          messagesContainerStyle={{ backgroundColor: 'transparent' }}
          renderBubble={(props) => (
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
            />
          )}
          renderMessageText={(props) => {
            const isCurrentUser = props.currentMessage?.user._id === user?.id;
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
  },
  inputToolbarWrapper: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(16,16,24,0.28)',
  },
});

// Ensure Android hardware back navigates to Discover instead of exiting app
function useAndroidBackToDiscover() {
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/discover');
        }
        return true;
      };
      if (Platform.OS === 'android') {
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
      }
      return undefined;
    }, [])
  );
}
