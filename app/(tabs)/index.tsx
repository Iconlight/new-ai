import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { FAB, Text, Card, IconButton, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useChat } from '../../src/contexts/ChatContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Chat } from '../../src/types';

export default function ChatsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { chats, createNewChat, deleteChat, refreshChats } = useChat();

  // Redirect to discover page since we're using top navigation layout
  useEffect(() => {
    router.replace('/discover');
  }, []);

  useEffect(() => {
    if (user) {
      refreshChats();
    }
  }, [user]);

  const handleCreateChat = async () => {
    const newChat = await createNewChat();
    if (newChat) {
      router.push(`/(tabs)/chat/${newChat.id}`);
    }
  };

  const handleChatPress = (chatId: string) => {
    router.push(`/(tabs)/chat/${chatId}`);
  };

  const handleDeleteChat = async (chatId: string) => {
    await deleteChat(chatId);
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <Card style={styles.chatCard} onPress={() => handleChatPress(item.id)}>
      <Card.Content style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.chatTitle}>
            {item.title}
          </Text>
          <IconButton
            icon="delete"
            size={20}
            onPress={() => handleDeleteChat(item.id)}
          />
        </View>
        <Text variant="bodySmall" style={styles.chatDate}>
          {new Date(item.updated_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Your Conversations
        </Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            No conversations yet
          </Text>
          <Text variant="bodyLarge" style={styles.emptySubtitle}>
            Start your first conversation with AI
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatsList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleCreateChat}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  chatsList: {
    padding: 16,
    paddingTop: 0,
  },
  chatCard: {
    marginBottom: 12,
  },
  chatContent: {
    paddingVertical: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatTitle: {
    flex: 1,
    marginRight: 8,
  },
  chatDate: {
    marginTop: 4,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
