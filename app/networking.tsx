import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Card, Button, Chip, useTheme, Appbar, FAB, Avatar } from 'react-native-paper';
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [networkingEnabled, setNetworkingEnabled] = useState(false);

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
      setMatches(userMatches);
      
      // Check if networking is enabled by looking for preferences in database
      await checkNetworkingStatus();
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

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
        router.push({ pathname: `/networking/chat/${conversation.id}`, params: { name: otherName } });
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

  const renderMatch = (match: NetworkingMatch) => (
    <Card key={match.id} style={styles.matchCard}>
      <Card.Content>
        <View style={styles.matchHeader}>
          <View style={styles.userInfo}>
            <Avatar.Text 
              size={48} 
              label={match.otherUser?.name?.charAt(0) || 'U'} 
              style={{ backgroundColor: theme.colors.primaryContainer }}
            />
            <View style={styles.userDetails}>
              <Text variant="titleMedium">{match.otherUser?.name || 'User'}</Text>
              {match.otherUser?.communicationStyle ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
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
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Compatibility: {match.compatibilityScore}%
          </Text>
          <Text variant="bodyMedium" style={styles.matchReason}>
            {match.matchReason}
          </Text>
        </View>

        {match.sharedInterests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text variant="titleSmall" style={styles.sectionTitle}>
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
                router.push({ pathname: `/networking/chat/${convoId}`, params: { name: match.otherUser?.name || '' } });
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="AI Networking" />
        </Appbar.Header>

        <View style={styles.enableContainer}>
          <Text variant="headlineMedium" style={styles.enableTitle}>
            🤝 AI-Powered Networking
          </Text>
          <Text variant="bodyLarge" style={styles.enableDescription}>
            Connect with people based on actual conversational compatibility, not just demographics.
          </Text>
          
          <View style={styles.featureList}>
            <Text variant="titleMedium" style={styles.featureTitle}>How it works:</Text>
            <Text variant="bodyMedium" style={styles.featureItem}>
              • AI analyzes your conversation patterns and interests
            </Text>
            <Text variant="bodyMedium" style={styles.featureItem}>
              • Finds people with compatible communication styles
            </Text>
            <Text variant="bodyMedium" style={styles.featureItem}>
              • Suggests personalized conversation starters
            </Text>
            <Text variant="bodyMedium" style={styles.featureItem}>
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
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="AI Networking" />
        <Appbar.Action icon="cog" onPress={() => router.push('/networking/settings')} />
      </Appbar.Header>

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
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="headlineSmall" style={styles.emptyTitle}>
                No matches yet
              </Text>
              <Text variant="bodyLarge" style={styles.emptySubtitle}>
                Find people with compatible conversation styles
              </Text>
            </View>
          ) : (
            matches.map(renderMatch)
          )}
        </View>
      </ScrollView>

      <FAB
        icon="account-search"
        label="Find Matches"
        onPress={handleFindNewMatches}
        loading={loading}
        style={styles.fab}
      />
    </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  enableContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  enableDescription: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.8,
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
    opacity: 0.8,
  },
  enableButton: {
    paddingHorizontal: 24,
  },
  matchCard: {
    marginBottom: 16,
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
});
