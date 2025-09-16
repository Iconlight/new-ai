import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useChat } from '../../src/contexts/ChatContext';
import { getTodaysProactiveTopics, generateAndScheduleProactiveConversations, markProactiveTopicAsSent } from '../../src/services/proactiveAI';
import { generateProactiveConversationStarters } from '../../src/services/ai';
import { ProactiveTopic } from '../../src/types';

export default function ExploreScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [todaysTopics, setTodaysTopics] = useState<ProactiveTopic[]>([]);
  const [forYouTopics, setForYouTopics] = useState<ProactiveTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const { startChatWithAI } = useChat();
  const [activeTab, setActiveTab] = useState<'foryou' | 'interests'>('interests');

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
      const topics = await getTodaysProactiveTopics(user.id);
      setTodaysTopics(topics);
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadForYouTopics = async () => {
    if (!user) return;
    try {
      const date = new Date().toLocaleDateString();
      const starters = await generateProactiveConversationStarters([], date);
      const nowIso = new Date().toISOString();
      const mapped: ProactiveTopic[] = starters.slice(0, 3).map((s, i) => ({
        id: `local-${Date.now()}-${i}`,
        user_id: user.id,
        topic: `For You ${i + 1}`,
        message: s,
        interests: [],
        is_sent: false,
        scheduled_for: nowIso,
        created_at: nowIso,
      } as ProactiveTopic));
      setForYouTopics(mapped);
    } catch (e) {
      console.error('Error loading for-you topics:', e);
      setForYouTopics([]);
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
        // Mark this proactive topic as sent only if it exists in DB
        if (!String(topic.id).startsWith('local-')) {
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

  const handleGenerateTopics = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (activeTab === 'interests') {
        await generateAndScheduleProactiveConversations(user.id);
        await loadTodaysTopics();
      } else {
        await loadForYouTopics();
      }
    } catch (error) {
      console.error('Error generating topics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Today's Conversations
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Discover personalized topics</Text>
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

      <View style={styles.content}>
        <Button
          mode="outlined"
          onPress={handleGenerateTopics}
          loading={loading}
          disabled={loading}
          style={styles.generateButton}
          icon="refresh"
        >
          Refresh
        </Button>

        {(activeTab === 'interests' ? todaysTopics : forYouTopics).length > 0 ? (
          (activeTab === 'interests' ? todaysTopics : forYouTopics).map((topic) => (
            <Card
              key={topic.id}
              style={styles.topicCard}
              onPress={() => handleStartTopic(topic)}
              disabled={startingTopicId === topic.id}
            >
              <Card.Content>
                <Text variant="titleMedium" style={styles.topicTitle}>
                  {topic.topic}
                </Text>
                <Text variant="bodyLarge" style={styles.topicMessage}>
                  {formatTopicMessage(topic.message)}
                </Text>
                <View style={styles.topicMeta}>
                  <Text variant="bodySmall" style={styles.metaText}>
                    Scheduled: {new Date(topic.scheduled_for).toLocaleTimeString()}
                  </Text>
                  {topic.is_sent && (
                    <Text variant="bodySmall" style={[styles.metaText, { color: theme.colors.primary }]}> 
                      ✓ Sent
                    </Text>
                  )}
                </View>
                {topic.interests.length > 0 && (
                  <View style={styles.interestsContainer}>
                    <Text variant="bodySmall" style={styles.interestsLabel}>
                      Based on: {topic.interests.slice(0, 3).join(', ')}
                      {topic.interests.length > 3 && ` +${topic.interests.length - 3} more`}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="headlineSmall" style={styles.emptyTitle}>
                No topics for today
              </Text>
              <Text variant="bodyLarge" style={styles.emptySubtitle}>
                Generate your first set of conversation starters
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </ScrollView>
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
  content: {
    padding: 16,
    paddingTop: 0,
  },
  generateButton: {
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tabButton: {
    flex: 1,
  },
  tabButtonActive: {
    // additional emphasis if desired
  },
  topicCard: {
    marginBottom: 12,
  },
  topicTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  topicMessage: {
    marginBottom: 12,
    lineHeight: 22,
  },
  topicMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    opacity: 0.7,
  },
  interestsContainer: {
    marginTop: 4,
  },
  interestsLabel: {
    opacity: 0.6,
    fontStyle: 'italic',
  },
  emptyCard: {
    marginTop: 40,
  },
  emptyContent: {
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
