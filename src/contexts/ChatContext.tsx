import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { generateAIResponse, generateChatTitle } from '../services/ai';
import { useAuth } from './AuthContext';
import { Chat, Message, GiftedChatMessage } from '../types';
import * as Crypto from 'expo-crypto';

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  messages: GiftedChatMessage[];
  loading: boolean;
  createNewChat: (title?: string) => Promise<Chat | null>;
  selectChat: (chatId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  startChatWithAI: (initialMessage: string, suggestedTitle?: string) => Promise<Chat | null>;
  isTyping: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<GiftedChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (user) {
      refreshChats();
    }
  }, [user]);

  const refreshChats = async () => {
    if (!user) {
      console.log('[ChatContext] No user, skipping chat refresh');
      return;
    }

    console.log('[ChatContext] Refreshing chats for user:', user.id);
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ChatContext] Error fetching chats:', error);
      } else {
        console.log('[ChatContext] Fetched chats:', data?.length || 0, 'chats');
        if (data && data.length > 0) {
          console.log('[ChatContext] First chat:', data[0]);
        }
        setChats(data || []);
      }
    } catch (error) {
      console.error('[ChatContext] Error fetching chats:', error);
    }
  };

  const startChatWithAI = async (initialMessage: string, suggestedTitle?: string): Promise<Chat | null> => {
    if (!user) return null;
    try {
      const chatTitle = suggestedTitle || 'New Conversation';

      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({ user_id: user.id, title: chatTitle })
        .select()
        .single();

      if (error || !newChat) {
        console.error('Error creating chat:', error);
        return null;
      }

      setCurrentChat(newChat);

      const aiMessage: GiftedChatMessage = {
        _id: Crypto.randomUUID(),
        text: initialMessage,
        createdAt: new Date(),
        user: {
          _id: 'ai',
          name: 'AI Assistant',
          avatar: '🤖',
        },
      };

      setMessages([aiMessage]);

      const { error: aiInsertError } = await supabase
        .from('messages')
        .insert({
          chat_id: newChat.id,
          user_id: user.id,
          content: initialMessage,
          role: 'assistant',
        });

      if (aiInsertError) {
        console.error('Error saving initial AI message:', aiInsertError);
      }

      // Generate a better title based on the initial AI prompt
      const title = await generateChatTitle([{ role: 'assistant', content: initialMessage }]);
      if (title && title !== newChat.title) {
        await supabase
          .from('chats')
          .update({ title })
          .eq('id', newChat.id);
        setCurrentChat({ ...newChat, title });
        await refreshChats();
      } else {
        await refreshChats();
      }

      return { ...newChat, title } as Chat;
    } catch (error) {
      console.error('Error starting chat with AI:', error);
      return null;
    }
  };

  const createNewChat = async (title?: string): Promise<Chat | null> => {
    if (!user) return null;

    try {
      const chatTitle = title || `Chat ${new Date().toLocaleDateString()}`;
      
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          title: chatTitle,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating chat:', error);
        return null;
      }

      await refreshChats();
      return data;
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  };

  const selectChat = async (chatId: string) => {
    if (!user) return;

    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    setCurrentChat(chat);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        const giftedMessages: GiftedChatMessage[] = (data || []).map((msg: Message) => ({
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.role === 'user' ? user.id : 'ai',
            name: msg.role === 'user' ? 'You' : 'AI Assistant',
            avatar: msg.role === 'user' ? undefined : '🤖',
          },
        })).reverse();

        setMessages(giftedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!user || !currentChat) return;

    const userMessage: GiftedChatMessage = {
      _id: Crypto.randomUUID(),
      text,
      createdAt: new Date(),
      user: {
        _id: user.id,
        name: 'You',
      },
    };

    setMessages(previousMessages => [userMessage, ...previousMessages]);

    try {
      // Save user message to database
      const { error: userMsgError } = await supabase
        .from('messages')
        .insert({
          chat_id: currentChat.id,
          user_id: user.id,
          content: text,
          role: 'user',
        });

      if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
      }

      // Get user interests for AI context
      const { data: interests } = await supabase
        .from('user_interests')
        .select('interest')
        .eq('user_id', user.id);

      const userInterests = interests?.map((i: any) => i.interest) || [];


      // Get conversation history for context
      const conversationHistory = messages.slice(0, 10).reverse().map(msg => ({
        role: msg.user._id === user.id ? 'user' as const : 'assistant' as const,
        content: msg.text,
      }));

      // Add current message
      conversationHistory.push({ role: 'user', content: text });

      // Generate AI response
      setIsTyping(true);
      const aiResponse = await generateAIResponse(conversationHistory, userInterests);

      const aiMessage: GiftedChatMessage = {
        _id: Crypto.randomUUID(),
        text: aiResponse.content,
        createdAt: new Date(),
        user: {
          _id: 'ai',
          name: 'AI Assistant',
          avatar: '🤖',
        },
      };

      setMessages(previousMessages => [aiMessage, ...previousMessages]);
      // Stop typing indicator as soon as the AI message is visible to the user
      setIsTyping(false);

      // Save AI message to database
      const { error: aiMsgError } = await supabase
        .from('messages')
        .insert({
          chat_id: currentChat.id,
          user_id: user.id,
          content: aiResponse.content,
          role: 'assistant',
        });

      if (aiMsgError) {
        console.error('Error saving AI message:', aiMsgError);
      }

      // Optionally (re)generate chat title based on the latest exchange
      const title = await generateChatTitle([...conversationHistory, { role: 'assistant', content: aiResponse.content }]);
      if (title && currentChat.title !== title) {
        await supabase
          .from('chats')
          .update({ title })
          .eq('id', currentChat.id);
        setCurrentChat({ ...currentChat, title });
        await refreshChats();
      }

      // Update chat timestamp
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentChat.id);

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting chat:', error);
      } else {
        if (currentChat?.id === chatId) {
          setCurrentChat(null);
          setMessages([]);
        }
        await refreshChats();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const value: ChatContextType = {
    chats,
    currentChat,
    messages,
    loading,
    createNewChat,
    selectChat,
    sendMessage,
    deleteChat,
    refreshChats,
    startChatWithAI,
    isTyping,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
