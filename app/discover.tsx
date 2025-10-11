import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator } from 'react-native';
import { Appbar, Button, IconButton, Text, useTheme } from 'react-native-paper';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import TopicSkeleton from '../components/ui/TopicSkeleton';
import { useAuth } from '../src/contexts/AuthContext';
import { useChat } from '../src/contexts/ChatContext';
import { getActiveFeedTopics, refreshForYouFeed, refreshInterestsFeed, fetchNextBatch } from '../src/services/feedService';
import { clearProactiveCache, markProactiveTopicAsSent } from '../src/services/proactiveAI';
import { supabase } from '../src/services/supabase';
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
  const [unreadNetworkingCount, setUnreadNetworkingCount] = useState(0);
  const drawerTranslateX = useRef(new Animated.Value(-300)).current;

  // Infinite scroll state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreForYou, setHasMoreForYou] = useState(true);
  const [hasMoreInterests, setHasMoreInterests] = useState(true);
  const [forYouPage, setForYouPage] = useState(0);
  const [interestsPage, setInterestsPage] = useState(0);
  const [shownForYouIds, setShownForYouIds] = useState<Set<string>>(new Set());
  const [shownInterestsIds, setShownInterestsIds] = useState<Set<string>>(new Set());

  // Helper: only UUIDs correspond to DB-backed proactive_topics
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

  // Load unread networking messages count
  const loadUnreadNetworkingCount = async () => {
    if (!user?.id) return;
    try {
      // Get all conversations where user is a participant
      const { data: conversations } = await supabase
        .from('networking_conversations')
        .select('id')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
      
      if (!conversations || conversations.length === 0) {
        setUnreadNetworkingCount(0);
        return;
      }
      
      const conversationIds = conversations.map(c => c.id);
      
      // Count unread messages from other users in these conversations
      const { count, error } = await supabase
        .from('networking_messages')
        .select('id', { count: 'exact' })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      
      if (!error) {
        setUnreadNetworkingCount(count || 0);
      }
    } catch (error) {
      console.error('Error loading unread networking count:', error);
      setUnreadNetworkingCount(0);
    }
  };

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
        loadUnreadNetworkingCount();
      }
      return () => {};
    }, [user?.id])
  );

  // Subscribe to realtime updates for networking messages
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel('discover-networking-unread')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'networking_messages'
      }, () => {
        // Reload count when any networking message changes
        loadUnreadNetworkingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
        console.log('[EdgeGesture] Start at x:', evt.nativeEvent.pageX, 'y:', evt.nativeEvent.pageY);
        // Don't capture touches in the hamburger button area (top 100px to be safe)
        if (evt.nativeEvent.pageY < 100) {
          console.log('[EdgeGesture] Ignoring touch in header area, y:', evt.nativeEvent.pageY);
          return false;
        }
        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Also check Y coordinate here as a backup
        if (evt.nativeEvent.pageY < 100) {
          console.log('[EdgeGesture] Ignoring move in header area, y:', evt.nativeEvent.pageY);
          return false;
        }
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
      setLoading(true);
      const topics = await getActiveFeedTopics(user.id, 'interests');
      setTodaysTopics(topics);
      if (topics.length === 0) {
        await refreshInterestsFeed(user.id);
        const fresh = await getActiveFeedTopics(user.id, 'interests');
        setTodaysTopics(fresh);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setLoading(false);
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
      // Reset pagination state on refresh
      if (activeTab === 'interests') {
        setInterestsPage(0);
        setShownInterestsIds(new Set());
        setHasMoreInterests(true);
      } else {
        setForYouPage(0);
        setShownForYouIds(new Set());
        setHasMoreForYou(true);
      }
    }
  }, [activeTab, user]);

  // Scroll handler for infinite scroll
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 500; // Trigger 500px before bottom
    
    const isNearBottom = 
      layoutMeasurement.height + contentOffset.y >= 
      contentSize.height - paddingToBottom;
    
    const hasMore = activeTab === 'interests' ? hasMoreInterests : hasMoreForYou;
    
    if (isNearBottom && !loadingMore && !loading && hasMore) {
      loadMoreTopics();
    }
  };

  // Load more topics for infinite scroll
  const loadMoreTopics = async () => {
    if (!user || loadingMore) return;
    
    const feedType = activeTab === 'interests' ? 'interests' : 'foryou';
    const currentPage = activeTab === 'interests' ? interestsPage : forYouPage;
    const shownIds = activeTab === 'interests' ? shownInterestsIds : shownForYouIds;
    
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      console.log(`📄 Loading page ${nextPage} for ${feedType} feed...`);
      
      // Fetch next batch with exclusions
      const newTopics = await fetchNextBatch(
        user.id,
        feedType,
        nextPage,
        Array.from(shownIds)
      );
      
      if (newTopics.length === 0) {
        console.log('📭 No more topics available');
        if (activeTab === 'interests') {
          setHasMoreInterests(false);
        } else {
          setHasMoreForYou(false);
        }
        return;
      }
      
      // Update shown IDs
      const newIds = new Set(shownIds);
      newTopics.forEach(t => {
        if (t.source_url) newIds.add(t.source_url);
      });
      
      // Append new topics
      if (activeTab === 'interests') {
        setTodaysTopics(prev => [...prev, ...newTopics]);
        setShownInterestsIds(newIds);
        setInterestsPage(nextPage);
      } else {
        setForYouTopics(prev => [...prev, ...newTopics]);
        setShownForYouIds(newIds);
        setForYouPage(nextPage);
      }
      
      console.log(`✅ Loaded ${newTopics.length} more topics (page ${nextPage})`);
    } catch (error) {
      console.error('Error loading more topics:', error);
    } finally {
      setLoadingMore(false);
    }
  };

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
      
      // Extract news context from topic
      const newsContext = topic.source_title ? {
        title: topic.source_title,
        url: topic.source_url,
        category: topic.category,
      } : undefined;
      
      const newChat = await startChatWithAI(topic.message, topic.topic, newsContext);
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
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Appbar.Header style={styles.glassHeader}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <Appbar.Action 
            icon="menu" 
            color="#ffffff"
            onPress={() => setDrawerOpen(true)}
          />
          <Appbar.Content title="ProactiveAI" titleStyle={{ color: '#ffffff' }} />
          <View style={{ position: 'relative' }}>
            <Appbar.Action 
              icon="account-group"
              color="#ffffff" 
              onPress={() => router.push('/networking')} 
            />
            {unreadNetworkingCount > 0 && (
              <View style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#EF4444',
                borderWidth: 2,
                borderColor: '#160427',
              }} />
            )}
          </View>
          <Appbar.Action 
            icon="account"
            color="#ffffff" 
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
      <View style={[styles.stickyTabs, styles.glassTabs]}>
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.tabRow}>
          <Button
            mode={activeTab === 'foryou' ? 'contained' : 'outlined'}
            style={[styles.tabButton, activeTab === 'foryou' ? styles.tabContained : styles.tabOutlined]}
            buttonColor={activeTab === 'foryou' ? 'rgba(255,255,255,0.10)' : undefined}
            textColor={activeTab === 'foryou' ? '#ffffff' : 'rgba(255,255,255,0.85)'}
            onPress={() => setActiveTab('foryou')}
          >
            For You
          </Button>
          <Button
            mode={activeTab === 'interests' ? 'contained' : 'outlined'}
            style={[styles.tabButton, activeTab === 'interests' ? styles.tabContained : styles.tabOutlined]}
            buttonColor={activeTab === 'interests' ? 'rgba(255,255,255,0.10)' : undefined}
            textColor={activeTab === 'interests' ? '#ffffff' : 'rgba(255,255,255,0.85)'}
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
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#C084FC"]}
            tintColor="#C084FC"
            progressBackgroundColor={'rgba(255,255,255,0.08)'}
            progressViewOffset={0}
          />
        }
      >
        <View style={styles.content}>
          {loading ? (
            // Show skeleton loading
            <>
              <TopicSkeleton isRight={false} />
              <TopicSkeleton isRight={true} />
              <TopicSkeleton isRight={false} />
              <TopicSkeleton isRight={true} />
              <TopicSkeleton isRight={false} />
              <TopicSkeleton isRight={true} />
            </>
          ) : currentTopics.length > 0 ? (
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

          {/* Loading More Indicator */}
          {loadingMore && currentTopics.length > 0 && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="large" color="#C084FC" />
              <Text variant="bodyMedium" style={styles.loadingMoreText}>
                Loading more topics...
              </Text>
            </View>
          )}

          {/* End of Feed Message */}
          {!loadingMore && !loading && currentTopics.length > 0 && 
           !(activeTab === 'interests' ? hasMoreInterests : hasMoreForYou) && (
            <View style={styles.endMessage}>
              <Text variant="titleMedium" style={styles.endText}>
                🎉 You've seen all available topics!
              </Text>
              <Text variant="bodyMedium" style={styles.endSubtext}>
                Pull down to refresh for new content
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Side Drawer for Chats */}
      <Animated.View style={[
        styles.drawer,
        { 
          transform: [{ translateX: drawerTranslateX }]
        }
      ]} {...drawerPanResponder.panHandlers}>
        <View style={styles.drawerHeader}>
          <Text variant="titleLarge" style={styles.drawerTitle}>Menu</Text>
          <IconButton icon="close" onPress={() => setDrawerOpen(false)} iconColor="#ffffff" />
        </View>
        
        {/* Networking Section */}
        <TouchableOpacity
          onPress={() => {
            setDrawerOpen(false);
            router.push('/networking');
          }}
          style={styles.networkingItem}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="bodyLarge" style={styles.networkingText}>🤝 AI Networking</Text>
            {unreadNetworkingCount > 0 && (
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#EF4444',
              }} />
            )}
          </View>
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
                  <Text variant="bodyMedium" style={[styles.chatItemText]} numberOfLines={2}>
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
            <AnimatedLoading transparentBackground size={96} message="" />
          </View>
        )}
    </SafeAreaView>
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
  stickyTabs: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  glassTabs: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
  },
  tabContained: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tabOutlined: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
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
    borderWidth: 1,
  },
  bubbleLeft: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bubbleRight: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  bubbleTitle: {
    marginBottom: 6,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bubbleMessage: {
    lineHeight: 22,
    marginBottom: 8,
    color: '#EDE9FE',
  },
  bubbleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    color: 'rgba(237,233,254,0.8)',
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
    color: '#FFFFFF',
  },
  emptySubtitle: {
    textAlign: 'center',
    color: 'rgba(237,233,254,0.8)',
  },
  loadingMore: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingMoreText: {
    color: '#C084FC',
    textAlign: 'center',
  },
  endMessage: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  endText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  endSubtext: {
    color: 'rgba(237,233,254,0.7)',
    textAlign: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  networkingText: {
    fontWeight: '500',
    color: '#FFFFFF',
  },
  chatItemButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#C084FC',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chatItemText: {
    lineHeight: 20,
    color: '#FFFFFF',
  },
  noChatText: {
    textAlign: 'center',
    padding: 20,
    color: 'rgba(237,233,254,0.8)',
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
    top: 100, // Start well below the header
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
  glassHeader: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
});
