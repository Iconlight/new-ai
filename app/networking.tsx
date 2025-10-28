import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Appbar, Avatar, Badge, Button, Card, Chip, FAB, IconButton, Text, useTheme } from 'react-native-paper';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import { ErrorBoundary, NetworkingErrorFallback } from '../src/components/ErrorBoundary';
import { useAuth } from '../src/contexts/AuthContext';
import {
  NetworkingMatch,
  acceptMatch,
  declineMatch,
  enableNetworking,
  ensureConversationExists,
  findNewMatches,
  getConversationIdByMatchId,
  getUserMatches,
} from '../src/services/networking';
import { supabase } from '../src/services/supabase';

function NetworkingScreenContent() {
  const theme = useTheme();
  const { user } = useAuth();
  const [matches, setMatches] = useState<NetworkingMatch[]>([]);
  const [connectedMatches, setConnectedMatches] = useState<NetworkingMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [networkingEnabled, setNetworkingEnabled] = useState<boolean | null>(null); // null = checking
  const [activeTab, setActiveTab] = useState('discover');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({}); // conversationId -> ISO string

  useEffect(() => {
    if (user) {
      checkNetworkingStatus(); // Check first
      loadMatches();
    }
  }, [user]);

  // Refresh matches and unread counts whenever this screen regains focus
  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;
      loadMatches();
      return undefined;
    }, [user?.id])
  );

  const checkNetworkingStatus = async () => {
    if (!user) return;
    
    try {
      const { data: preferences } = await supabase
        .from('user_networking_preferences')
        .select('is_networking_enabled')
        .eq('user_id', user.id)
        .single();
      
      setNetworkingEnabled(preferences?.is_networking_enabled || false);
    } catch (error) {
      console.error('Error checking networking status:', error);
      setNetworkingEnabled(false);
    }
  };

  const loadMatches = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userMatches = await getUserMatches(user.id);
      
      // Separate matches by status
      const pendingMatches = userMatches.filter(match => match.status === 'pending');
      const acceptedMatches = userMatches.filter(match => match.status === 'accepted');
      
      setMatches(pendingMatches);
      setConnectedMatches(acceptedMatches);
      
      // Load message counts and last activity for connected matches
      await loadMessageCounts(acceptedMatches);
      
      // Check if networking is enabled by looking for preferences in database
      await checkNetworkingStatus();
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessageCounts = async (acceptedMatches: NetworkingMatch[]) => {
    if (!user || acceptedMatches.length === 0) return;
    
    try {
      const unread: Record<string, number> = {};
      const activity: Record<string, string> = {};
      
      for (const match of acceptedMatches) {
        if (match.conversationId) {
          // Unread from other user
          const { count: unreadCount, error: unreadErr } = await supabase
            .from('networking_messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', match.conversationId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

          // Latest message timestamp for sorting
          const { data: latestMsg } = await supabase
            .from('networking_messages')
            .select('created_at')
            .eq('conversation_id', match.conversationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          unread[match.conversationId] = unreadErr ? 0 : (unreadCount || 0);
          if (latestMsg?.created_at) activity[match.conversationId] = latestMsg.created_at;
        }
      }
      
      setUnreadCounts(unread);
      setLastActivity(activity);

      // Sort connected matches by last activity (desc)
      setConnectedMatches(prev => {
        const arr = [...prev];
        arr.sort((a, b) => {
          const ta = a.conversationId ? Date.parse(activity[a.conversationId] || '') : 0;
          const tb = b.conversationId ? Date.parse(activity[b.conversationId] || '') : 0;
          return tb - ta;
        });
        return arr;
      });
    } catch (error) {
      console.error('Error loading unread counts:', error);
    }
  };

  // Realtime: move updated conversations to top and update unread counts
  useEffect(() => {
    if (!user) return;
    
    console.log('[Networking] Setting up realtime subscriptions, user:', user.id);
    
    const channel = supabase
      .channel('rt-networking-list-main')
      // Listen for new messages
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'networking_messages' 
      }, (payload) => {
        const msg: any = payload.new;
        console.log('[Networking] ✅ New message INSERT event received:', {
          messageId: msg.id,
          conversationId: msg.conversation_id,
          senderId: msg.sender_id,
          currentUserId: user.id,
          isFromOtherUser: msg.sender_id !== user.id
        });
        
        if (!msg?.conversation_id) {
          console.log('[Networking] ⚠️ Message missing conversation_id, ignoring');
          return;
        }
        
        // Move to top
        setConnectedMatches(prev => {
          const idx = prev.findIndex(m => m.conversationId === msg.conversation_id);
          if (idx === -1) {
            console.log('[Networking] ⚠️ Conversation not found in list, reloading matches');
            // Conversation might be new, reload matches
            loadMatches();
            return prev;
          }
          console.log('[Networking] Moving conversation to top, index was:', idx);
          const copy = [...prev];
          const [item] = copy.splice(idx, 1);
          copy.unshift(item);
          return copy;
        });
        
        // Update unread if it's from the other user
        if (msg.sender_id !== user.id) {
          console.log('[Networking] ✅ Incrementing unread count for conversation:', msg.conversation_id);
          setUnreadCounts(prev => {
            const oldCount = prev[msg.conversation_id] || 0;
            const newCount = oldCount + 1;
            console.log('[Networking] Unread count updated:', msg.conversation_id, 'from', oldCount, 'to', newCount);
            return { ...prev, [msg.conversation_id]: newCount };
          });
        } else {
          console.log('[Networking] Message is from current user, not incrementing unread');
        }
        
        // Update last activity for sort
        setLastActivity(prev => ({ ...prev, [msg.conversation_id]: msg.created_at }));
      })
      // Listen for message updates (read status changes)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'networking_messages'
      }, async (payload) => {
        const msg: any = payload.new;
        console.log('[Networking] Message UPDATE event:', msg.id, 'is_read:', msg.is_read);
        
        // If message was marked as read, recalculate unread count for that conversation
        if (msg.is_read && msg.conversation_id && user?.id) {
          // Query the actual unread count instead of decrementing
          const { count } = await supabase
            .from('networking_messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', msg.conversation_id)
            .neq('sender_id', user.id)
            .eq('is_read', false);
          
          console.log('[Networking] Recalculated unread count for conversation:', msg.conversation_id, 'count:', count);
          setUnreadCounts(prev => ({ ...prev, [msg.conversation_id]: count || 0 }));
        }
      })
      .subscribe((status) => {
        console.log('[Networking] 🔌 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Networking] ✅ Successfully subscribed to realtime updates');
        } else if (status === 'CLOSED') {
          console.log('[Networking] ❌ Subscription closed');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('[Networking] ❌ Channel error');
        }
      });

    return () => {
      console.log('[Networking] 🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const handleEnableNetworking = async () => {
    if (!user) return;

    Alert.alert(
      'Enable AI Networking',
      'This will analyze your conversation patterns to find compatible people for meaningful discussions. Your privacy is protected - only you control who you connect with.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              const success = await enableNetworking(user.id);
              if (success) {
                await checkNetworkingStatus(); // This will set networkingEnabled to true
                await loadMatches();
              } else {
                console.warn('[Networking] enableNetworking() returned false. Likely RLS or missing tables.');
                Alert.alert(
                  'Could not enable networking',
                  'Please ensure you are signed in and that the networking tables are created in Supabase (run add_networking_tables.sql).'
                );
              }
            } catch (e: any) {
              console.error('[Networking] Failed to enable networking:', e?.message || e);
              Alert.alert(
                'Error enabling networking',
                'An unexpected error occurred. Check your internet connection and Supabase configuration, then try again.'
              );
            }
          }
        }
      ]
    );
  };

  const handleFindNewMatches = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const newMatches = await findNewMatches(user.id);
      if (newMatches.length > 0) {
        setMatches(prev => [...newMatches, ...prev]);
        Alert.alert('New Matches Found!', `Found ${newMatches.length} compatible people for you to connect with.`);
      } else {
        Alert.alert('No New Matches', 'No new compatible matches found right now. Check back later!');
      }
    } catch (error) {
      console.error('Error finding new matches:', error);
      Alert.alert('Error', 'Failed to find new matches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptMatch = async (matchId: string) => {
    if (!user) return;

    try {
      const conversation = await acceptMatch(matchId, user.id);
      if (conversation) {
        // Find the match to get the other user's name for immediate header
        const match = matches.find(m => m.id === matchId);
        const otherName = match?.otherUser?.name || '';
        // Navigate directly to the networking conversation with name param
        router.push({ pathname: '/networking/chat/[id]', params: { id: conversation.id, name: otherName } });
        // Refresh matches in background
        loadMatches();
      }
    } catch (error) {
      console.error('Error accepting match:', error);
      Alert.alert('Error', 'Failed to accept match. Please try again.');
    }
  };

  const handleDeclineMatch = async (matchId: string) => {
    Alert.alert(
      'Decline Match',
      'Are you sure you want to decline this match?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const success = await declineMatch(matchId, user?.id || '');
            if (success) {
              await loadMatches();
            }
          }
        }
      ]
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      // Get all conversation IDs for connected matches
      const conversationIds = connectedMatches
        .map(m => m.conversationId)
        .filter(Boolean) as string[];

      if (conversationIds.length === 0) {
        Alert.alert('No conversations', 'You don\'t have any active conversations yet.');
        return;
      }

      // Mark all messages as read for these conversations
      const { error } = await supabase
        .from('networking_messages')
        .update({ is_read: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('[Networking] Error marking all as read:', error);
        Alert.alert('Error', 'Failed to mark all messages as read. Please try again.');
      } else {
        // Optimistically clear all unread counts
        setUnreadCounts({});
        Alert.alert('Success', 'All messages marked as read');
      }
    } catch (error) {
      console.error('[Networking] Error in handleMarkAllAsRead:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.colors.primary;
      case 'accepted': return theme.colors.tertiary;
      case 'declined': return theme.colors.error;
      case 'expired': return theme.colors.outline;
      default: return theme.colors.primary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'New Match';
      case 'accepted': return 'Connected';
      case 'declined': return 'Declined';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  const renderConnectedMatch = (match: NetworkingMatch) => {
    const unreadCount = match.conversationId ? unreadCounts[match.conversationId] || 0 : 0;
    
    return (
      <Card key={match.id} style={[styles.matchCard, styles.glassCard]}>
        <Card.Content>
          <View style={styles.matchHeader}>
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <Avatar.Text 
                  size={48} 
                  label={match.otherUser?.name?.charAt(0) || 'U'} 
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                />
                {unreadCount > 0 && (
                  <Badge 
                    size={20} 
                    style={styles.unreadBadge}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </View>
              <View style={styles.userDetails}>
                <Text variant="titleMedium" style={{ color: '#FFFFFF' }}>{match.otherUser?.name || 'User'}</Text>
                {match.otherUser?.communicationStyle ? (
                  <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {match.otherUser.communicationStyle.charAt(0).toUpperCase() + match.otherUser.communicationStyle.slice(1)} communicator
                  </Text>
                ) : null}
                {unreadCount > 0 && (
                  <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
                    Unread {unreadCount}
                  </Text>
                )}
              </View>
            </View>
            {unreadCount > 0 && (
              <View style={styles.unreadIndicator} />
            )}
          </View>

          <Button 
            mode="contained" 
            onPress={async () => {
              if (!user?.id) return;
              const convoId = match.conversationId || await ensureConversationExists(match.id, user.id);
              if (convoId) {
                // Optimistically clear unread for instant UI feedback
                setUnreadCounts(prev => ({ ...prev, [convoId]: 0 }));
                router.push({ pathname: '/networking/chat/[id]', params: { id: convoId, name: match.otherUser?.name || '' } });
              } else {
                Alert.alert('Conversation not ready', 'This match has not been fully accepted yet. Please try again in a moment.');
              }
            }}
            style={styles.chatButton}
          >
            Open Conversation
          </Button>
        </Card.Content>
      </Card>
    );
  };

  const renderMatch = (match: NetworkingMatch) => (
    <Card key={match.id} style={[styles.matchCard, styles.glassCard]}>
      <Card.Content>
        <View style={styles.matchHeader}>
          <View style={styles.userInfo}>
            <Avatar.Text 
              size={48} 
              label={match.otherUser?.name?.charAt(0) || 'U'} 
              style={{ backgroundColor: theme.colors.primaryContainer }}
            />
            <View style={styles.userDetails}>
              <Text variant="titleMedium" style={{ color: '#FFFFFF' }}>{match.otherUser?.name || 'User'}</Text>
              {match.otherUser?.communicationStyle ? (
                <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {match.otherUser.communicationStyle.charAt(0).toUpperCase() + match.otherUser.communicationStyle.slice(1)} communicator
                </Text>
              ) : null}
            </View>
          </View>
          <Chip 
            mode="outlined" 
            textStyle={{ color: getStatusColor(match.status) }}
            style={{ borderColor: getStatusColor(match.status) }}
          >
            {getStatusText(match.status)}
          </Chip>
        </View>

        <View style={styles.compatibilitySection}>
          <Text variant="titleSmall" style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
            Compatibility: {match.compatibilityScore}%
          </Text>
          <Text variant="bodyMedium" style={[styles.matchReason, { color: 'rgba(255,255,255,0.8)' }]}>
            {match.matchReason}
          </Text>
        </View>

        {match.sharedInterests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text variant="titleSmall" style={[styles.sectionTitle, { color: '#FFFFFF' }]}>
              Shared Interests:
            </Text>
            <View style={styles.interestsContainer}>
              {match.sharedInterests.map((interest, index) => (
                <Chip key={index} mode="outlined" compact style={styles.interestChip}>
                  {interest}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {match.status === 'pending' && (
          <>
            <Button 
              mode="outlined" 
              onPress={() => router.push({ pathname: '/networking/intelligence/[matchId]', params: { matchId: match.id } })}
              style={styles.askAIButton}
              icon="brain"
            >
              Ask AI About Them
            </Button>
            <View style={styles.actionButtons}>
              <Button 
                mode="contained" 
                onPress={() => handleAcceptMatch(match.id)}
                style={styles.acceptButton}
              >
                Connect
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => handleDeclineMatch(match.id)}
                style={styles.declineButton}
              >
                Pass
              </Button>
            </View>
          </>
        )}

        {match.status === 'accepted' && (
          <Button 
            mode="contained" 
            onPress={async () => {
              if (!user?.id) return;
              const convoId = match.conversationId || await ensureConversationExists(match.id, user.id);
              if (convoId) {
                // Optimistically clear unread for instant UI feedback
                setUnreadCounts(prev => ({ ...prev, [convoId]: 0 }));
                router.push({ pathname: '/networking/chat/[id]', params: { id: convoId, name: match.otherUser?.name || '' } });
              } else {
                Alert.alert('Conversation not ready', 'This match has not been fully accepted yet. Please try again in a moment.');
              }
            }}
            style={styles.chatButton}
          >
            Open Conversation
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  // Show loading while checking networking status
  if (networkingEnabled === null) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <View style={[styles.container, { backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }]}>
          <AnimatedLoading transparentBackground size={96} message="" />
        </View>
      </LinearGradient>
    );
  }

  if (!networkingEnabled) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
          {/* Floating Header */}
          <View style={styles.floatingHeader}>
            {/* Back Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Title - Floating Text */}
            <Text style={styles.headerTitleText}>AI Networking</Text>

            {/* Settings Button - Icon Only */}
            <IconButton
              icon="cog"
              iconColor="#ffffff"
              size={24}
              onPress={() => router.push('/networking/settings')}
              style={styles.iconButton}
            />
          </View>

          <View style={styles.enableContainer}>
            <Card style={[styles.enableCard, styles.glassCard]}>
              <Card.Content>
                <Text variant="headlineMedium" style={[styles.enableTitle, { color: '#FFFFFF' }]}>
                  🤝 AI-Powered Networking
                </Text>
                <Text variant="bodyLarge" style={[styles.enableDescription, { color: 'rgba(237,233,254,0.85)' }]}>
                  Connect with people based on actual conversational compatibility, not just demographics.
                </Text>
                
                <View style={styles.featureList}>
                  <Text variant="titleMedium" style={[styles.featureTitle, { color: '#FFFFFF' }]}>How it works:</Text>
                  <Text variant="bodyMedium" style={[styles.featureItem, { color: 'rgba(237,233,254,0.85)' }]}>
                    • AI analyzes your conversation patterns and interests
                  </Text>
                  <Text variant="bodyMedium" style={[styles.featureItem, { color: 'rgba(237,233,254,0.85)' }]}>
                    • Finds people with compatible communication styles
                  </Text>
                  <Text variant="bodyMedium" style={[styles.featureItem, { color: 'rgba(237,233,254,0.85)' }]}>
                    • Suggests personalized conversation starters
                  </Text>
                  <Text variant="bodyMedium" style={[styles.featureItem, { color: 'rgba(237,233,254,0.85)' }]}>
                    • Privacy-first: you control all connections
                  </Text>
                </View>

                <Button 
                  mode="contained" 
                  onPress={handleEnableNetworking}
                  style={styles.enableButton}
                >
                  Enable AI Networking
                </Button>
              </Card.Content>
            </Card>
          </View>
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
      <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          {/* Back Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Title - Floating Text */}
          <Text style={styles.headerTitleText}>AI Networking</Text>

          {/* Settings Button - Icon Only */}
          <IconButton
            icon="cog"
            iconColor="#ffffff"
            size={24}
            onPress={() => router.push('/networking/settings')}
            style={styles.iconButton}
          />
        </View>

        {/* Floating Tab Buttons */}
        <View style={styles.floatingTabContainer}>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('discover')}
              style={styles.floatingTab}
            >
              <Text style={[styles.floatingTabText, activeTab === 'discover' && styles.floatingTabTextActive]}>
                Discover
              </Text>
              {activeTab === 'discover' && (
                <View style={styles.tabIndicator} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveTab('connected')}
              style={styles.floatingTab}
            >
              <Text style={[styles.floatingTabText, activeTab === 'connected' && styles.floatingTabTextActive]}>
                Connected
              </Text>
              {activeTab === 'connected' && (
                <View style={styles.tabIndicator} />
              )}
            </TouchableOpacity>
          </View>
          
          {activeTab === 'connected' && connectedMatches.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleMarkAllAsRead}
              style={[
                styles.markAllReadButton,
                !Object.values(unreadCounts).some(c => c > 0) && styles.markAllReadButtonDisabled
              ]}
              disabled={!Object.values(unreadCounts).some(c => c > 0)}
            >
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color={Object.values(unreadCounts).some(c => c > 0) ? "#C084FC" : "rgba(192, 132, 252, 0.4)"} 
              />
              <Text style={[
                styles.markAllReadText,
                !Object.values(unreadCounts).some(c => c > 0) && styles.markAllReadTextDisabled
              ]}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#C084FC"]}
              tintColor="#C084FC"
            />
          }
        >
          <View style={styles.content}>
            {activeTab === 'discover' ? (
              matches.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="headlineSmall" style={[styles.emptyTitle, { color: '#FFFFFF' }]}>
                    No matches yet
                  </Text>
                  <Text variant="bodyLarge" style={[styles.emptySubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                    Find people with compatible conversation styles
                  </Text>
                </View>
              ) : (
                matches.map(renderMatch)
              )
            ) : (
              connectedMatches.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="headlineSmall" style={[styles.emptyTitle, { color: '#FFFFFF' }]}>
                    No connections yet
                  </Text>
                  <Text variant="bodyLarge" style={[styles.emptySubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                    Accept matches to start conversations
                  </Text>
                </View>
              ) : (
                connectedMatches.map(renderConnectedMatch)
              )
            )}
          </View>
        </ScrollView>

        {activeTab === 'discover' && (
          <FAB
            icon="account-search"
            label="Find Matches"
            onPress={handleFindNewMatches}
            loading={loading}
            style={styles.fab}
          />
        )}
      </View>
    </LinearGradient>
  );
}

export default function NetworkingScreen() {
  return (
    <ErrorBoundary fallback={NetworkingErrorFallback}>
      <NetworkingScreenContent />
    </ErrorBoundary>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  floatingTabContainer: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  markAllReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  markAllReadButtonDisabled: {
    backgroundColor: 'rgba(192, 132, 252, 0.05)',
    borderColor: 'rgba(192, 132, 252, 0.15)',
    opacity: 0.6,
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C084FC',
  },
  markAllReadTextDisabled: {
    color: 'rgba(192, 132, 252, 0.4)',
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
  avatarContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  },
  unreadIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  enableContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableCard: {
    alignSelf: 'stretch',
  },
  enableTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  enableDescription: {
    textAlign: 'center',
    marginBottom: 32,
  },
  featureList: {
    alignSelf: 'stretch',
    marginBottom: 32,
  },
  featureTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  featureItem: {
    marginBottom: 8,
  },
  enableButton: {
    paddingHorizontal: 24,
  },
  matchCard: {
    marginBottom: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  compatibilitySection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  matchReason: {
    opacity: 0.8,
  },
  interestsSection: {
    marginBottom: 16,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  askAIButton: {
    marginBottom: 12,
    borderColor: '#7C3AED',
    borderWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
  },
  chatButton: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    marginTop: 64,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
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
  headerIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  iconButton: {
    margin: 0,
  },
});
