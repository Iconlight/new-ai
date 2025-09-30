import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Card, Button, Chip, useTheme, Appbar, FAB, Avatar, SegmentedButtons, Badge } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { 
  NetworkingMatch, 
  findNewMatches, 
  getUserMatches, 
  acceptMatch, 
  declineMatch,
  enableNetworking,
  getConversationIdByMatchId,
} from '../src/services/networking';
import { supabase } from '../src/services/supabase';
import { ErrorBoundary, NetworkingErrorFallback } from '../src/components/ErrorBoundary';

function NetworkingScreenContent() {
  const theme = useTheme();
  const { user } = useAuth();
  const [matches, setMatches] = useState<NetworkingMatch[]>([]);
  const [connectedMatches, setConnectedMatches] = useState<NetworkingMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [networkingEnabled, setNetworkingEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({}); // conversationId -> ISO string

  useEffect(() => {
    if (user) {
      loadMatches();
    }
  }, [user]);

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
    const channel = supabase
      .channel('rt-networking-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'networking_messages' }, (payload) => {
        const msg: any = payload.new;
        if (!msg?.conversation_id) return;
        // Move to top
        setConnectedMatches(prev => {
          const idx = prev.findIndex(m => m.conversationId === msg.conversation_id);
          if (idx === -1) return prev;
          const copy = [...prev];
          const [item] = copy.splice(idx, 1);
          copy.unshift(item);
          return copy;
        });
        // Update unread if it's from the other user
        if (msg.sender_id !== user.id) {
          setUnreadCounts(prev => ({ ...prev, [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1 }));
        }
        // Update last activity for sort
        setLastActivity(prev => ({ ...prev, [msg.conversation_id]: msg.created_at }));
      })
      .subscribe();

    return () => {
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
              const convoId = match.conversationId || await getConversationIdByMatchId(match.id);
              if (convoId) {
                router.push({ pathname: '/networking/chat/[id]', params: { id: convoId, name: match.otherUser?.name || '' } });
              } else {
                Alert.alert('Conversation not ready', 'Please try again in a moment.');
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
        )}

        {match.status === 'accepted' && (
          <Button 
            mode="contained" 
            onPress={async () => {
              const convoId = match.conversationId || await getConversationIdByMatchId(match.id);
              if (convoId) {
                router.push({ pathname: '/networking/chat/[id]', params: { id: convoId, name: match.otherUser?.name || '' } });
              } else {
                Alert.alert('Conversation not ready', 'Please try again in a moment.');
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

  if (!networkingEnabled) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
          <Appbar.Header style={styles.glassHeader}>
            <Appbar.BackAction color="#ffffff" onPress={() => router.back()} />
            <Appbar.Content title="AI Networking" titleStyle={{ color: '#ffffff' }} />
          </Appbar.Header>

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
        <Appbar.Header style={styles.glassHeader}>
          <Appbar.BackAction color="#ffffff" onPress={() => router.back()} />
          <Appbar.Content title="AI Networking" titleStyle={{ color: '#ffffff' }} />
          <Appbar.Action color="#ffffff" icon="cog" onPress={() => router.push('/networking/settings')} />
        </Appbar.Header>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={[
              {
                value: 'discover',
                label: 'Discover',
                icon: 'account-search',
              },
              {
                value: 'connected',
                label: 'Connected',
                icon: 'account-group',
              },
            ]}
            style={styles.segmentedButtons}
          />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  segmentedButtons: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
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
