import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, RefreshControl, SafeAreaView, TouchableOpacity, ScrollView, PanResponder, Animated } from 'react-native';
import { Text, useTheme, Button, Appbar, Drawer, IconButton, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../src/contexts/AuthContext';
import { useChat } from '../src/contexts/ChatContext';
import { markProactiveTopicAsSent, clearProactiveCache } from '../src/services/proactiveAI';
import { getActiveFeedTopics, refreshInterestsFeed, refreshForYouFeed } from '../src/services/feedService';
import { ProactiveTopic } from '../src/types';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { chats, startChatWithAI, refreshChats, selectChat, createNewChat } = useChat();
  const [todaysTopics, setTodaysTopics] = useState<ProactiveTopic[]>([]);
  const [forYouTopics, setForYouTopics] = useState<ProactiveTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'foryou' | 'interests'>('foryou');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(-300)).current;

  // Helper: only UUIDs correspond to DB-backed proactive_topics
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

  useEffect(() => {
    if (!user) return;
    loadInitialData();
  }, [user, activeTab]);

  // Ensure recent chats are available
  useEffect(() => {
    if (user?.id) {
      refreshChats();
    }
  }, [user?.id]);

  // Also refresh when Discover gains focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('[Discover] Refreshing chats for user:', user.id);
        refreshChats();
      }
      return () => {};
    }, [user?.id])
  );

  // Refresh chats when opening the drawer so list is current
  useEffect(() => {
    if (drawerOpen && user?.id) {
      console.log('[Discover] Drawer opened, refreshing chats');
      refreshChats();
    }
  }, [drawerOpen, user?.id]);

  // Debug chat list
  useEffect(() => {
    console.log('[Discover] Chats updated, count:', chats.length);
    if (chats.length > 0) {
      console.log('[Discover] First chat:', chats[0]);
    }
  }, [chats]);

  // Animate drawer open/close
  useEffect(() => {
    Animated.timing(drawerTranslateX, {
      toValue: drawerOpen ? 0 : -300,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen]);

  // Left-edge swipe to open drawer
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        console.log('[EdgeGesture] Start at x:', evt.nativeEvent.pageX);
        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const shouldSet = Math.abs(gestureState.dx) > 5 && gestureState.dx > 0;
        if (shouldSet) console.log('[EdgeGesture] Moving right, dx:', gestureState.dx);
        return shouldSet;
      },
      onPanResponderGrant: () => {
        console.log('[EdgeGesture] Gesture granted');
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          const tx = Math.min(0, -300 + gestureState.dx);
          drawerTranslateX.setValue(tx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log('[EdgeGesture] Release dx:', gestureState.dx, 'vx:', gestureState.vx);
        if (gestureState.dx > 30 || gestureState.vx > 0.35) {
          console.log('[EdgeGesture] Opening drawer');
          setDrawerOpen(true);
        } else {
          console.log('[EdgeGesture] Closing drawer');
          setDrawerOpen(false);
        }
      },
    })
  ).current;

  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > Math.abs(g.dy) && g.dx < -8,
      onPanResponderMove: (e, g) => {
        if (g.dx < 0) {
          const tx = Math.max(-300, g.dx);
          drawerTranslateX.setValue(tx);
        }
      },
      onPanResponderRelease: (e, g) => {
        if (g.dx < -30 || g.vx < -0.35) {
          setDrawerOpen(false);
        } else {
          setDrawerOpen(true);
        }
      },
    })
  ).current;

  const loadInitialData = async () => {
    if (activeTab === 'interests') {
      await loadTodaysTopics();
    } else {
      await loadForYouTopics();
    }
  };

  const loadTodaysTopics = async () => {
    if (!user) return;
    try {
      const topics = await getActiveFeedTopics(user.id, 'interests');
      setTodaysTopics(topics);
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Clear caches so we always fetch fresh internet data (news + location)
      await clearProactiveCache();

      if (activeTab === 'interests') {
        if (user?.id) {
          await refreshInterestsFeed(user.id);
          await loadTodaysTopics();
        }
      } else {
        if (user?.id) {
          await refreshForYouFeed(user.id);
          await loadForYouTopics();
        }
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, user]);

  const formatTopicMessage = (raw: string): string => {
    if (!raw) return '';
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    try {
      if (s.startsWith('[')) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length) {
          const first = typeof arr[0] === 'string' ? arr[0] : arr[0]?.text;
          if (first) return String(first).trim();
        }
      }
    } catch {}
    s = s.replace(/^\[+\s*/, '').replace(/\s*\]+$/, '');
    s = s.replace(/^"+\s*/, '').replace(/\s*"+$/, '');
    const firstLine = s.split('\n').map(l => l.trim()).find(Boolean);
    return firstLine || 'Tap to start this conversation';
  };

  const handleStartTopic = async (topic: ProactiveTopic) => {
    if (!user || startingTopicId) return;
    try {
      setStartingTopicId(topic.id);
      setNavLoading(true);
      const newChat = await startChatWithAI(topic.message, topic.topic);
      if (newChat) {
        if (isUuid(String(topic.id))) {
          try { await markProactiveTopicAsSent(topic.id); } catch {}
        }
        router.push({ pathname: '/(tabs)/chat/[id]', params: { id: newChat.id, opening: '1' } });
      }
    } catch (e) {
      console.error('Failed to start chat from topic:', e);
    } finally {
      setStartingTopicId(null);
      // navLoading will stop after navigation away; safe to reset after a short delay in case navigation is cancelled
      setTimeout(() => setNavLoading(false), 400);
    }
  };

  const handleChatPress = async (chatId: string) => {
    try {
      setNavLoading(true);
      // Preselect chat to prefetch messages and speed up navigation
      await selectChat?.(chatId);
      // Small delay so the Discover overlay is visible before transition
      await new Promise(resolve => setTimeout(resolve, 180));
    } catch {}
    setDrawerOpen(false);
    router.push({ pathname: '/(tabs)/chat/[id]', params: { id: chatId, opening: '1' } });
    // Allow overlay to be visible during transition
    setTimeout(() => setNavLoading(false), 400);
  };

  const currentTopics = activeTab === 'interests' ? todaysTopics : forYouTopics;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Action 
          icon="menu" 
          onPress={() => setDrawerOpen(true)} 
        />
        <Appbar.Content title="ProactiveAI" />
        <Appbar.Action 
          icon="account-group" 
          onPress={() => router.push('/networking')} 
        />
        <Appbar.Action 
          icon="account" 
          onPress={() => router.push('/profile')} 
        />
      </Appbar.Header>

      {/* Left-edge gesture catcher for opening the drawer */}
      <View
        style={styles.edgeCatcher}
        pointerEvents={drawerOpen ? 'none' : 'box-only'}
        {...edgePanResponder.panHandlers}
      />

      {/* Sticky Tab Bar */}
      <View style={[styles.stickyTabs, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.tabRow}>
          <Button
            mode={activeTab === 'foryou' ? 'contained' : 'outlined'}
            style={[styles.tabButton]}
            onPress={() => setActiveTab('foryou')}
          >
            For You
          </Button>
          <Button
            mode={activeTab === 'interests' ? 'contained' : 'outlined'}
            style={[styles.tabButton]}
            onPress={() => setActiveTab('interests')}
          >
            Interests
          </Button>
        </View>
      </View>

      {/* Main Content with Pull-to-Refresh */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surface}
            progressViewOffset={0}
          />
        }
      >
        <View style={styles.content}>
          {currentTopics.length > 0 ? (
            currentTopics.map((topic, idx) => {
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

      {/* Side Drawer for Chats */}
      <Animated.View style={[
        styles.drawer,
        { 
          backgroundColor: theme.colors.surface,
          transform: [{ translateX: drawerTranslateX }]
        }
      ]} {...drawerPanResponder.panHandlers}>
        <View style={styles.drawerHeader}>
          <Text variant="titleLarge" style={styles.drawerTitle}>Menu</Text>
          <IconButton icon="close" onPress={() => setDrawerOpen(false)} />
        </View>
        
        {/* Networking Section */}
        <TouchableOpacity
          onPress={() => {
            setDrawerOpen(false);
            router.push('/networking');
          }}
          style={styles.networkingItem}
        >
          <Text variant="bodyLarge" style={styles.networkingText}>🤝 AI Networking</Text>
        </TouchableOpacity>
        
        <View style={[styles.drawerHeader, { paddingTop: 16 }]}>
          <Text variant="titleMedium" style={styles.drawerTitle}>Recent Chats</Text>
        </View>
        <ScrollView 
          style={styles.chatList} 
          contentContainerStyle={styles.chatListContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          bounces={false}
        >
          {chats.length > 0 ? (
            chats.map((chat) => {
              console.log('[Discover] Rendering chat:', chat.title);
              return (
                <TouchableOpacity
                  key={chat.id}
                  onPress={() => handleChatPress(chat.id)}
                  style={styles.chatItemButton}
                >
                  <Text variant="bodyMedium" style={[styles.chatItemText, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {chat.title || 'Untitled chat'}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noChatContainer}>
              <Text variant="bodyMedium" style={styles.noChatText}>
                No chats yet. Start a conversation from the topics above!
              </Text>
            </View>
          )}
          <Text variant="bodySmall" style={styles.debugText}>
            Debug: {chats.length} chats loaded
          </Text>
        </ScrollView>
      </Animated.View>

        {/* Overlay for drawer close */}
        {drawerOpen && (
          <TouchableOpacity 
            style={styles.overlay} 
            onPress={() => setDrawerOpen(false)}
            activeOpacity={1}
          />
        )}

        {/* Navigation loading overlay when opening chats from Discover */}
        {navLoading && (
          <View style={styles.navOverlay}>
            <ActivityIndicator animating size="large" color={theme.colors.primary} />
          </View>
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    zIndex: 2100,
    elevation: 16,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    paddingBottom: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  drawerTitle: {
    fontWeight: 'bold',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    marginHorizontal: 8,
    marginVertical: 2,
  },
  networkingItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderRadius: 8,
  },
  networkingText: {
    fontWeight: '500',
  },
  chatItemButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(0, 122, 255, 0.7)',
  },
  chatItemText: {
    lineHeight: 20,
  },
  noChatText: {
    textAlign: 'center',
    padding: 20,
    opacity: 0.6,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  },
  navOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    backgroundColor: 'rgba(0,0,0,0.15)'
  },
  edgeCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 50,
    zIndex: 1100,
    backgroundColor: 'transparent',
  },
  noChatContainer: {
    padding: 20,
    alignItems: 'center',
  },
  debugText: {
    textAlign: 'center',
    padding: 8,
    opacity: 0.5,
  },
  chatListContent: {
    paddingBottom: 20,
    paddingTop: 8,
  },
});
