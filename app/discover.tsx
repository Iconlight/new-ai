import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator, Share, Platform } from 'react-native';
import { Appbar, Button, IconButton, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import TopicSkeleton from '../components/ui/TopicSkeleton';
import TopicCard from '../components/TopicCard';
import { useAuth } from '../src/contexts/AuthContext';
import { useChat } from '../src/contexts/ChatContext';
import { getActiveFeedTopics, refreshForYouFeed, refreshInterestsFeed, fetchNextBatch } from '../src/services/feedService';
import { reactToTopic, unreactToTopic, saveTopic, unsaveTopic, hideTopic, hideCategory as hideCategoryFunc, getUserTopicReaction, isTopicSaved } from '../src/services/topicEngagement';
import { analytics } from '../src/services/analytics';
import { createShareLink } from '../src/services/shareLinks';
import { clearProactiveCache, markProactiveTopicAsSent } from '../src/services/proactiveAI';
import { supabase } from '../src/services/supabase';
import { ProactiveTopic } from '../src/types';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { chats, startChatWithAI, refreshChats, selectChat, createNewChat } = useChat();
  const insets = useSafeAreaInsets(); // Get device safe area insets
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
  const [likedTopics, setLikedTopics] = useState<Set<string>>(new Set());
  const [savedTopics, setSavedTopics] = useState<Set<string>>(new Set());

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

  // Swipe right from anywhere to open drawer
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't capture touches in the header area (top 80px)
        if (evt.nativeEvent.pageY < 80) {
          return false;
        }
        // Detect swipe right gesture (horizontal swipe to the right)
        const isSwipeRight = gestureState.dx > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isSwipeRight;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Secondary check (in case capture didn't run)
        if (evt.nativeEvent.pageY < 80) return false;
        return gestureState.dx > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        console.log('[SwipeGesture] Swipe right detected');
      },
      onPanResponderMove: () => {
        // Don't track movement - just detect the gesture
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log('[SwipeGesture] Swipe right - opening drawer');
        // Any swipe right opens the drawer fully
        setDrawerOpen(true);
      },
    })
  ).current;

  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > Math.abs(g.dy) && g.dx < -8,
      onPanResponderMove: () => {
        // Don't track movement - just detect the gesture
      },
      onPanResponderRelease: (e, g) => {
        console.log('[SwipeGesture] Swipe left - closing drawer');
        // Any swipe left closes the drawer fully
        setDrawerOpen(false);
      },
    })
  ).current;

  const loadInitialData = async () => {
    // Load user's liked and saved topics first
    await loadUserEngagement();
    
    if (activeTab === 'interests') {
      await loadTodaysTopics();
    } else {
      await loadForYouTopics();
    }
  };

  const loadUserEngagement = async () => {
    if (!user?.id) return;
    
    try {
      // Load liked topics
      const { data: reactions } = await supabase
        .from('topic_reactions')
        .select('topic_id')
        .eq('user_id', user.id);
      
      if (reactions) {
        setLikedTopics(new Set(reactions.map(r => r.topic_id)));
      }

      // Load saved topics
      const { data: saved } = await supabase
        .from('saved_topics')
        .select('topic_id')
        .eq('user_id', user.id);
      
      if (saved) {
        setSavedTopics(new Set(saved.map(s => s.topic_id)));
      }
    } catch (error) {
      console.error('Error loading user engagement:', error);
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
    const paddingToBottom = 300; // Trigger 300px before bottom
    
    // Calculate if we're near the bottom
    const scrollPosition = contentOffset.y + layoutMeasurement.height;
    const contentHeight = contentSize.height;
    const isNearBottom = scrollPosition >= contentHeight - paddingToBottom;
    
    const hasMore = activeTab === 'interests' ? hasMoreInterests : hasMoreForYou;
    const currentTopics = activeTab === 'interests' ? todaysTopics : forYouTopics;
    
    // Only load if: near bottom, not already loading, has content, and has more to load
    if (isNearBottom && !loadingMore && !loading && hasMore && currentTopics.length > 0) {
      console.log('📜 Scroll detected near bottom, loading more...');
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
    
    // Decode HTML entities like &apos; &#39; etc.
    s = s.replace(/&apos;/g, "'")
         .replace(/&#39;/g, "'")
         .replace(/&quot;/g, '"')
         .replace(/&#34;/g, '"')
         .replace(/&amp;/g, '&')
         .replace(/&lt;/g, '<')
         .replace(/&gt;/g, '>')
         .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    
    // Remove weird number sequences and noise patterns
    s = s.replace(/\b\d{8,}\b/g, '') // Remove long number sequences (8+ digits)
         .replace(/[^\w\s.,!?'"()-]/g, ' ') // Remove unusual characters
         .replace(/\s+/g, ' ') // Normalize whitespace
         .trim();

    // Strip conversational hook openers that add little value
    const openerPatterns = [
      /^low[- ]?key big news:\s*/i,
      /^okay,? this is wild:\s*/i,
      /^spotted this making waves:\s*/i,
      /^tiny detail,? huge implications:\s*/i,
      /^heads up:\s*/i,
      /^did you see this\?\s*/i,
    ];
    for (const pat of openerPatterns) {
      if (pat.test(s)) {
        s = s.replace(pat, '').trim();
        break;
      }
    }

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
        description: topic.source_description,
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

  // Topic action handlers
  const handleLikeTopic = async (topic: ProactiveTopic) => {
    if (!user?.id) return;
    
    const isCurrentlyLiked = likedTopics.has(topic.id);
    
    // Optimistic update
    setLikedTopics(prev => {
      const next = new Set(prev);
      if (isCurrentlyLiked) {
        next.delete(topic.id);
      } else {
        next.add(topic.id);
      }
      return next;
    });

    // Sync with backend
    if (isCurrentlyLiked) {
      await unreactToTopic(user.id, topic.id);
    } else {
      await reactToTopic(user.id, topic.id, 'like', topic.category);
    }
  };

  const handleSaveTopic = async (topic: ProactiveTopic) => {
    if (!user?.id) return;
    
    const isCurrentlySaved = savedTopics.has(topic.id);
    
    // Optimistic update
    setSavedTopics(prev => {
      const next = new Set(prev);
      if (isCurrentlySaved) {
        next.delete(topic.id);
      } else {
        next.add(topic.id);
      }
      return next;
    });

    // Sync with backend
    if (isCurrentlySaved) {
      await unsaveTopic(user.id, topic.id);
    } else {
      await saveTopic(
        user.id, 
        topic.id, 
        topic.topic, 
        topic.message, 
        topic.source_description || '', // Article content from RSS
        topic.category, 
        topic.source_url
      );
    }
  };

  const handleShareTopic = async (topic: ProactiveTopic) => {
    if (!user?.id) return;
    
    try {
      const payload = {
        itemType: 'topic' as const,
        itemId: topic.id,
        userId: user.id,
        title: topic.topic,
        description: formatTopicMessage(topic.message),
        imageUrl: undefined,
        sourceUrl: topic.source_url || undefined,
        category: topic.category || undefined,
        newsContext: topic.source_title ? {
          title: topic.source_title,
          description: topic.source_description || undefined,
          url: topic.source_url || undefined,
          category: topic.category || undefined,
          content: topic.source_description || undefined,
        } : undefined,
      };

      const link = await createShareLink(payload);
      const url = link?.url || topic.source_url || '';
      // Share only the URL to maximize rich preview cards across apps
      const sharePayload = Platform.select({ ios: { url }, android: { message: url } }) as any;
      await Share.share(sharePayload);

      analytics.trackTopicShared(user.id, topic.id);
    } catch (error) {
      console.error('Error sharing topic:', error);
    }
  };

  const handleHideTopic = async (topic: ProactiveTopic, shouldHideCategory?: boolean) => {
    if (!user?.id) return;
    
    if (shouldHideCategory && topic.category) {
      await hideCategoryFunc(user.id, topic.category);
      // Remove all topics from this category
      if (activeTab === 'interests') {
        setTodaysTopics(prev => prev.filter(t => t.category !== topic.category));
      } else {
        setForYouTopics(prev => prev.filter(t => t.category !== topic.category));
      }
    } else {
      await hideTopic(user.id, topic.id, topic.category);
      // Remove just this topic
      if (activeTab === 'interests') {
        setTodaysTopics(prev => prev.filter(t => t.id !== topic.id));
      } else {
        setForYouTopics(prev => prev.filter(t => t.id !== topic.id));
      }
    }
  };

  const currentTopics = activeTab === 'interests' ? todaysTopics : forYouTopics;

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View
        style={[styles.container, { backgroundColor: 'transparent' }]}
        {...edgePanResponder.panHandlers}
      >
        {/* Floating Header */}
        <View style={[styles.floatingHeader, { paddingTop: Math.max(insets.top, 40) + 12 }]}>
          {/* Menu Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDrawerOpen(true)}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.headerIcon}>☰</Text>
          </TouchableOpacity>

          {/* Title - Floating Text */}
          <Text style={styles.headerTitleText}>ProactiveAI</Text>

          {/* Right Button Group: Saved + Networking + Profile */}
          <View style={styles.headerButtonGroup}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.headerGroupIconWrap}>
              <IconButton
                icon="bookmark-multiple"
                iconColor="#ffffff"
                size={22}
                onPress={() => router.push('/saved-topics')}
                style={styles.iconButton}
              />
            </View>
            <View style={styles.headerGroupDivider} />
            <View style={styles.headerGroupIconWrap}>
              <IconButton
                icon="account-group"
                iconColor="#ffffff"
                size={22}
                onPress={() => router.push('/networking')}
                style={styles.iconButton}
              />
              {unreadNetworkingCount > 0 && (
                <View style={styles.headerGroupBadge} />
              )}
            </View>
            <View style={styles.headerGroupDivider} />
            <View style={styles.headerGroupIconWrap}>
              <IconButton
                icon="account"
                iconColor="#ffffff"
                size={22}
                onPress={() => router.push('/profile')}
                style={styles.iconButton}
              />
            </View>
          </View>
        </View>

      {/* Floating Tab Buttons */}
      <View style={styles.floatingTabContainer}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('foryou')}
          style={styles.floatingTab}
        >
          <Text style={[styles.floatingTabText, activeTab === 'foryou' && styles.floatingTabTextActive]}>
            For You
          </Text>
          {activeTab === 'foryou' && (
            <View style={styles.tabIndicator} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setActiveTab('interests')}
          style={styles.floatingTab}
        >
          <Text style={[styles.floatingTabText, activeTab === 'interests' && styles.floatingTabTextActive]}>
            Interests
          </Text>
          {activeTab === 'interests' && (
            <View style={styles.tabIndicator} />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content with Pull-to-Refresh */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#C084FC"]}
            tintColor="#C084FC"
            progressBackgroundColor={'rgba(255,255,255,0.08)'}
            progressViewOffset={0}
          />
        }>
        <View style={styles.content}>
          {loading ? (
            // Show skeleton loading
            <>
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
            </>
          ) : currentTopics.length > 0 ? (
            currentTopics.map((topic, idx) => {
              return (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onPress={() => handleStartTopic(topic)}
                  onLike={() => handleLikeTopic(topic)}
                  onSave={() => handleSaveTopic(topic)}
                  onShare={() => handleShareTopic(topic)}
                  isLiked={likedTopics.has(topic.id)}
                  isSaved={savedTopics.has(topic.id)}
                  disabled={startingTopicId === topic.id}
                  formatMessage={formatTopicMessage}
                />
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
      </View>
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
  floatingTabContainer: {
    flexDirection: 'row',
    gap: 32,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  floatingTabText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  floatingTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabIndicator: {
    marginTop: 6,
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C084FC',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
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
  topicCard: {
    width: '100%',
    padding: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: 16,
  },
  cardMessage: {
    lineHeight: 22,
    marginBottom: 12,
    color: '#EDE9FE',
  },
  cardMeta: {
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
  swipeArea: {
    position: 'absolute',
    top: 80, // Start below the header
    left: 0,
    right: 0,
    bottom: 0,
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
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  headerButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerGroupIconWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGroupDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  headerGroupBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#160427',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  iconButton: {
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#160427',
  },
});
