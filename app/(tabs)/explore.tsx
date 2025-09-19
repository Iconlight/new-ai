import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useChat } from '../../src/contexts/ChatContext';
import { markProactiveTopicAsSent, clearProactiveCache } from '@/src/services/proactiveAI';
import { getActiveFeedTopics, refreshInterestsFeed, refreshForYouFeed } from '@/src/services/feedService';
import { ProactiveTopic } from '../../src/types';

export default function ExploreScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [todaysTopics, setTodaysTopics] = useState<ProactiveTopic[]>([]);
  const [forYouTopics, setForYouTopics] = useState<ProactiveTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const { startChatWithAI } = useChat();
  const [activeTab, setActiveTab] = useState<'foryou' | 'interests'>('interests');

  // Helper to determine if an ID is a UUID (DB-backed) vs synthetic (news/location/...)
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'interests') {
      loadTodaysTopics();
    } else {
      loadForYouTopics();
    }
  }, [user, activeTab]);

  const loadTodaysTopics = async () => {
    if (!user) return;
    
    try {
      const topics = await getActiveFeedTopics(user.id, 'interests');
      setTodaysTopics(topics);
      // Auto-refresh to create a batch on first load
      if (topics.length === 0) {
        await refreshInterestsFeed(user.id);
        const fresh = await getActiveFeedTopics(user.id, 'interests');
        setTodaysTopics(fresh);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadForYouTopics = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Load persisted For You batch topics
      const topics = await getActiveFeedTopics(user.id, 'foryou');
      setForYouTopics(topics);
      if (topics.length === 0) {
        await refreshForYouFeed(user.id);
        const fresh = await getActiveFeedTopics(user.id, 'foryou');
        setForYouTopics(fresh);
      }
    } catch (error) {
      console.error('Error loading For You topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTopicMessage = (raw: string): string => {
    if (!raw) return '';
    let s = raw.trim();
    // Strip code fences
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    // Try JSON array
    try {
      if (s.startsWith('[')) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length) {
          const first = typeof arr[0] === 'string' ? arr[0] : arr[0]?.text;
          if (first) return String(first).trim();
        }
      }
    } catch {}
    // Remove leading/trailing brackets/quotes leftovers
    s = s.replace(/^\[+\s*/, '').replace(/\s*\]+$/, '');
    s = s.replace(/^"+\s*/, '').replace(/\s*"+$/, '');
    // If multiple lines or bullets, take first non-empty line
    const firstLine = s.split('\n').map(l => l.trim()).find(Boolean);
    return firstLine || 'Tap to start this conversation';
  };

  const handleStartTopic = async (topic: ProactiveTopic) => {
    if (!user || startingTopicId) return;
    try {
      setStartingTopicId(topic.id);
      // Start a new chat where AI opens with the topic message
      const newChat = await startChatWithAI(topic.message, topic.topic);
      if (newChat) {
        // Mark this proactive topic as sent only if it exists in DB (UUID id)
        if (isUuid(String(topic.id))) {
          try { await markProactiveTopicAsSent(topic.id); } catch {}
        }
        // Navigate to the chat screen
        router.push({ pathname: '/(tabs)/chat/[id]', params: { id: newChat.id } });
      }
    } catch (e) {
      console.error('Failed to start chat from topic:', e);
    } finally {
      setStartingTopicId(null);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      // Clear cache to force fresh content generation
      await clearProactiveCache();
      
      if (activeTab === 'interests') {
        await refreshInterestsFeed(user.id);
        await loadTodaysTopics();
      } else {
        await refreshForYouFeed(user.id);
        await loadForYouTopics();
      }
    } catch (error) {
      console.error('Error refreshing topics:', error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Today's Conversations
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Discover personalized topics</Text>
      </View>

      {/* Sticky Tab Bar */}
      <View style={[styles.stickyTabs, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.tabRow}>
          <Button
            mode={activeTab === 'foryou' ? 'contained' : 'outlined'}
            style={[styles.tabButton, activeTab === 'foryou' && styles.tabButtonActive]}
            onPress={() => setActiveTab('foryou')}
          >
            For You
          </Button>
          <Button
            mode={activeTab === 'interests' ? 'contained' : 'outlined'}
            style={[styles.tabButton, activeTab === 'interests' && styles.tabButtonActive]}
            onPress={() => setActiveTab('interests')}
          >
            Interests
          </Button>
        </View>
      </View>

      {/* Main Content with Pull-to-Refresh */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
          <View style={styles.content}>
            {(activeTab === 'interests' ? todaysTopics : forYouTopics).length > 0 ? (
              (activeTab === 'interests' ? todaysTopics : forYouTopics).map((topic, idx) => {
                const isRight = idx % 2 === 1;
                return (
                  <View key={topic.id} style={[styles.bubbleRow, isRight ? styles.rowRight : styles.rowLeft]}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleStartTopic(topic)}
                      disabled={startingTopicId === topic.id}
                      style={[styles.bubble, isRight ? styles.bubbleRight : styles.bubbleLeft]}
                    >
                      <Text variant="titleSmall" style={styles.bubbleTitle}>
                        {topic.topic}
                      </Text>
                      <Text variant="bodyMedium" style={styles.bubbleMessage}>
                        {formatTopicMessage(topic.message)}
                      </Text>
                      <View style={styles.bubbleMeta}>
                        <Text variant="bodySmall" style={styles.metaText}>
                          {new Date(topic.scheduled_for).toLocaleTimeString()}
                        </Text>
                        {topic.interests.length > 0 && (
                          <Text variant="bodySmall" style={styles.metaText}>
                            {topic.interests.slice(0, 2).join(', ')}
                            {topic.interests.length > 2 && ` +${topic.interests.length - 2}`}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text variant="headlineSmall" style={styles.emptyTitle}>
                  No topics available
                </Text>
                <Text variant="bodyLarge" style={styles.emptySubtitle}>
                  Pull down to refresh and get new conversation starters
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
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
      marginBottom: 8,
    },
    subtitle: {
      opacity: 0.7,
    },
    stickyTabs: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      elevation: 2,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 8,
    },
    tabButton: {
      flex: 1,
    },
    tabButtonActive: {
      // additional emphasis if desired
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    bubbleRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    rowLeft: {
      justifyContent: 'flex-start',
    },
    rowRight: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '85%',
      padding: 12,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    bubbleLeft: {
      backgroundColor: 'rgba(0,0,0,0.06)',
    },
    bubbleRight: {
      backgroundColor: 'rgba(0,122,255,0.12)',
    },
    bubbleTitle: {
      marginBottom: 6,
      fontWeight: '600',
    },
    bubbleMessage: {
      lineHeight: 22,
      marginBottom: 8,
    },
    bubbleMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    metaText: {
      opacity: 0.6,
    },
    emptyState: {
      marginTop: 40,
      alignItems: 'center',
      padding: 20,
    },
    emptyTitle: {
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      textAlign: 'center',
      opacity: 0.7,
    },
  });
