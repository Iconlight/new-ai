import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Share } from 'react-native';
import { Text, Appbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useChat } from '../src/contexts/ChatContext';
import { getSavedTopics, unsaveTopic, markSavedTopicOpened, SavedTopic } from '../src/services/topicEngagement';
import { analytics } from '../src/services/analytics';
import { createShareLink } from '../src/services/shareLinks';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import TopicCard from '../components/TopicCard';
import { ProactiveTopic } from '../src/types';

export default function SavedTopicsScreen() {
  const { user } = useAuth();
  const { startChatWithAI, selectChat } = useChat();
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingTopicId, setOpeningTopicId] = useState<string | null>(null);

  const loadSavedTopics = async () => {
    if (!user?.id) return;
    
    try {
      const topics = await getSavedTopics(user.id);
      setSavedTopics(topics);
    } catch (error) {
      console.error('Error loading saved topics:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      analytics.trackScreenViewed(user?.id, 'saved_topics');
      loadSavedTopics();
    }, [user?.id])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSavedTopics();
    setRefreshing(false);
  };

  const handleTopicPress = async (topic: SavedTopic) => {
    if (!user?.id || openingTopicId) return;

    console.log('[SavedTopics] Opening topic:', topic.topicTitle);
    
    try {
      setOpeningTopicId(topic.id);

      // Mark as opened
      await markSavedTopicOpened(user.id, topic.topicId);
      
      // Update local state
      setSavedTopics(prev =>
        prev.map(t => t.id === topic.id ? { ...t, opened: true } : t)
      );

      analytics.track('topic_opened', user.id, { topicId: topic.topicId, source: 'saved_topics' });

      // Prepare initial message (fallback to article content if needed)
      const initialMessage = topic.topicMessage || (topic.articleContent ? `Let's discuss: ${topic.topicTitle || 'this article'}\n\n${topic.articleContent}` : null);

      // Start a conversation with this topic including full article context
      if (initialMessage) {
        console.log('[SavedTopics] Creating chat with message:', initialMessage.substring(0, 50));
        
        const chat = await startChatWithAI(
          initialMessage,
          topic.topicTitle || 'Saved Topic',
          {
            title: topic.topicTitle || 'Saved Topic',
            description: initialMessage,
            url: topic.sourceUrl || undefined,
            category: topic.topicCategory || undefined,
            content: topic.articleContent || undefined, // Full RSS article content
          }
        );
        
        console.log('[SavedTopics] Chat created:', chat?.id);
        
        if (chat) {
          // Prefetch and navigate
          try {
            await selectChat(chat.id);
          } catch {}
          console.log('[SavedTopics] Navigating to chat:', chat.id);
          router.push({ pathname: '/(tabs)/chat/[id]', params: { id: chat.id, opening: '1' } });
        } else {
          console.error('[SavedTopics] Chat creation returned null');
          Alert.alert(
            'Error',
            'Failed to create chat. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.error('[SavedTopics] Topic missing message');
        Alert.alert(
          'Unable to start conversation',
          'This saved topic is missing conversation content. Please save it again from Discover to include the article context.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[SavedTopics] Error opening saved topic:', error);
      Alert.alert(
        'Error',
        'Failed to start conversation. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setOpeningTopicId(null);
    }
  };

  const handleUnsave = (topic: SavedTopic) => {
    Alert.alert(
      'Remove from saved?',
      'This topic will be removed from your saved list.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            // Optimistic update
            setSavedTopics(prev => prev.filter(t => t.id !== topic.id));
            
            // Sync with backend
            await unsaveTopic(user.id, topic.topicId);
            
            analytics.track('topic_saved', user.id, { topicId: topic.topicId, action: 'unsaved' });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        style={styles.container}
      >
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => router.back()} color="#FFFFFF" />
          <Appbar.Content title="Saved Topics" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <AnimatedLoading message="Loading saved topics..." transparentBackground />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      style={styles.container}
    >
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} color="#FFFFFF" />
        <Appbar.Content title="Saved Topics" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={["#7C3AED"]}
          />
        }
      >
        {savedTopics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📌</Text>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No saved topics yet
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              Tap the bookmark icon on any topic to save it for later
            </Text>
          </View>
        ) : (
          <View style={styles.topicsList}>
            <Text variant="bodyMedium" style={styles.countText}>
              {savedTopics.length} saved {savedTopics.length === 1 ? 'topic' : 'topics'}
            </Text>
            
            {savedTopics.map((topic) => {
              // Convert SavedTopic to ProactiveTopic format for TopicCard
              const proactiveTopic: ProactiveTopic = {
                id: topic.topicId,
                user_id: topic.userId,
                topic: topic.topicTitle || 'Untitled Topic',
                message: topic.topicMessage || topic.articleContent || '',
                interests: [],
                scheduled_for: topic.savedAt,
                is_sent: true,
                created_at: topic.savedAt,
                source_url: topic.sourceUrl || undefined,
                source_title: topic.topicTitle || undefined,
                source_description: topic.articleContent || undefined,
                category: topic.topicCategory || undefined,
              };
              
              return (
                <TopicCard
                  key={topic.id}
                  topic={proactiveTopic}
                  onPress={() => handleTopicPress(topic)}
                  onLike={() => {}}
                  onSave={() => handleUnsave(topic)}
                  onShare={async () => {
                    try {
                      const payload = {
                        itemType: 'topic' as const,
                        itemId: topic.topicId,
                        userId: user?.id,
                        title: topic.topicTitle || 'Saved Topic',
                        description: topic.topicMessage || topic.articleContent || undefined,
                        imageUrl: undefined,
                        sourceUrl: topic.sourceUrl || undefined,
                        category: topic.topicCategory || undefined,
                        newsContext: {
                          title: topic.topicTitle || 'Saved Topic',
                          description: topic.topicMessage || undefined,
                          url: topic.sourceUrl || undefined,
                          category: topic.topicCategory || undefined,
                          content: topic.articleContent || undefined,
                        },
                      };
                      const link = await createShareLink(payload);
                      const shareMessage = `Discuss on ProactiveAI: ${payload.title}\n\n${payload.description || ''}\n\nLink: ${link?.url || (payload.sourceUrl || '')}`.trim();
                      await Share.share({ message: shareMessage, url: link?.url || payload.sourceUrl });
                      if (user?.id) analytics.trackTopicShared(user.id, topic.topicId);
                    } catch (e) {
                      console.error('Error sharing saved topic:', e);
                    }
                  }}
                  isLiked={false}
                  isSaved={true}
                  disabled={openingTopicId === topic.id}
                  formatMessage={(msg) => {
                    const lines = msg.split('\n').filter(line => line.trim());
                    const firstLine = lines[0] || '';
                    return firstLine.length > 150 ? firstLine.substring(0, 150) + '...' : firstLine;
                  }}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
      {openingTopicId && (
        <View style={styles.overlay} pointerEvents="none">
          <AnimatedLoading message="Opening conversation..." transparentBackground />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  topicsList: {
    // TopicCard has its own marginBottom
  },
  countText: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});
