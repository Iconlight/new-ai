import { supabase } from './supabase';
import { analyzeConversationPattern, findCompatibleUsers, generateNetworkingConversationStarter, UserCompatibility } from './conversationAnalysis';

export interface NetworkingMatch {
  id: string;
  userId1: string;
  userId2: string;
  compatibilityScore: number;
  sharedInterests: string[];
  matchReason: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  otherUser?: {
    id: string;
    name: string;
    avatar?: string;
    interests: string[];
    communicationStyle: string;
  };
}

export interface NetworkingConversation {
  id: string;
  matchId: string;
  userId1: string;
  userId2: string;
  conversationStarter: string;
  status: 'initiated' | 'active' | 'paused' | 'ended';
  lastMessageAt?: Date;
  createdAt: Date;
  otherUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

/**
 * Enables networking for a user and sets their preferences
 */
export const enableNetworking = async (
  userId: string,
  preferences: {
    visibilityLevel?: 'public' | 'limited' | 'private';
    maxMatchesPerDay?: number;
    preferredCommunicationStyles?: string[];
    minimumCompatibilityScore?: number;
  } = {}
): Promise<boolean> => {
  try {
    // First, analyze the user's conversation patterns
    try {
      await analyzeConversationPattern(userId);
    } catch (e: any) {
      console.warn('[Networking] analyzeConversationPattern threw:', e?.message || e);
    }

    // Set networking preferences
    const { error } = await supabase
      .from('user_networking_preferences')
      .upsert({
        user_id: userId,
        is_networking_enabled: true,
        visibility_level: preferences.visibilityLevel || 'limited',
        max_matches_per_day: preferences.maxMatchesPerDay || 5,
        preferred_communication_styles: preferences.preferredCommunicationStyles || [],
        minimum_compatibility_score: preferences.minimumCompatibilityScore || 60
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Networking] Upsert user_networking_preferences failed:', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error enabling networking:', error);
    return false;
  }
};

/**
 * Finds new matches for a user based on their conversation patterns
 */
export const findNewMatches = async (userId: string): Promise<NetworkingMatch[]> => {
  try {
    // Check if user has networking enabled
    const { data: preferences } = await supabase
      .from('user_networking_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('is_networking_enabled', true)
      .single();

    if (!preferences) return [];

    // Check daily match limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayMatches } = await supabase
      .from('user_matches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id_1', userId)
      .gte('created_at', today.toISOString());

    if (todayMatches && todayMatches >= preferences.max_matches_per_day) {
      return [];
    }

    // Find compatible users
    const compatibilities = await findCompatibleUsers(userId);
    
    // Filter out existing matches and blocked users
    const { data: existingMatches } = await supabase
      .from('user_matches')
      .select('user_id_2')
      .eq('user_id_1', userId);

    const existingMatchIds = new Set(existingMatches?.map(m => m.user_id_2) || []);
    const blockedUsers = new Set(preferences.blocked_users || []);

    const newCompatibilities = compatibilities.filter(comp => 
      !existingMatchIds.has(comp.userId2) && 
      !blockedUsers.has(comp.userId2) &&
      comp.compatibilityScore >= preferences.minimum_compatibility_score
    );

    // Create matches in database
    const matches: NetworkingMatch[] = [];
    for (const comp of newCompatibilities.slice(0, preferences.max_matches_per_day - (todayMatches || 0))) {
      const { data: match, error } = await supabase
        .from('user_matches')
        .insert({
          user_id_1: userId,
          user_id_2: comp.userId2,
          compatibility_score: comp.compatibilityScore,
          shared_interests: comp.sharedInterests,
          complementary_traits: comp.complementaryTraits,
          conversation_potential: comp.conversationPotential,
          match_reason: comp.matchReason
        })
        .select()
        .single();

      if (!error && match) {
        // Get other user's profile info
        const { data: otherUserProfile } = await supabase
          .from('user_conversation_patterns')
          .select('communication_style, interests')
          .eq('user_id', comp.userId2)
          .single();

        matches.push({
          id: match.id,
          userId1: match.user_id_1,
          userId2: match.user_id_2,
          compatibilityScore: match.compatibility_score,
          sharedInterests: match.shared_interests,
          matchReason: match.match_reason,
          status: match.status,
          createdAt: new Date(match.created_at),
          expiresAt: new Date(match.expires_at),
          otherUser: {
            id: comp.userId2,
            name: 'User', // Would get from profiles table
            interests: otherUserProfile?.interests || [],
            communicationStyle: otherUserProfile?.communication_style || 'unknown'
          }
        });

        // Log activity
        await supabase
          .from('networking_activity')
          .insert({
            user_id: userId,
            activity_type: 'match_found',
            related_user_id: comp.userId2,
            metadata: { compatibility_score: comp.compatibilityScore }
          });
      }
    }

    return matches;
  } catch (error) {
    console.error('Error finding new matches:', error);
    return [];
  }
};

/**
 * Gets all matches for a user
 */
export const getUserMatches = async (userId: string): Promise<NetworkingMatch[]> => {
  try {
    const { data: matches, error } = await supabase
      .from('user_matches')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error || !matches) return [];

    return matches.map(match => ({
      id: match.id,
      userId1: match.user_id_1,
      userId2: match.user_id_2,
      compatibilityScore: match.compatibility_score,
      sharedInterests: match.shared_interests,
      matchReason: match.match_reason,
      status: match.status,
      createdAt: new Date(match.created_at),
      expiresAt: new Date(match.expires_at)
    }));
  } catch (error) {
    console.error('Error getting user matches:', error);
    return [];
  }
};

/**
 * Accepts a match and creates a networking conversation
 */
export const acceptMatch = async (matchId: string, userId: string): Promise<NetworkingConversation | null> => {
  try {
    // Update match status
    const { data: match, error: matchError } = await supabase
      .from('user_matches')
      .update({ status: 'accepted' })
      .eq('id', matchId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .select()
      .single();

    if (matchError || !match) return null;

    // Generate conversation starter
    const conversationStarter = await generateNetworkingConversationStarter(
      match.user_id_1,
      match.user_id_2
    );

    // Create networking conversation
    const { data: conversation, error: convError } = await supabase
      .from('networking_conversations')
      .insert({
        match_id: matchId,
        user_id_1: match.user_id_1,
        user_id_2: match.user_id_2,
        conversation_starter: conversationStarter
      })
      .select()
      .single();

    if (convError || !conversation) return null;

    // Add starter message
    await supabase
      .from('networking_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: match.user_id_1, // System message from the matcher
        content: conversationStarter,
        message_type: 'starter'
      });

    // Log activity
    await supabase
      .from('networking_activity')
      .insert({
        user_id: userId,
        activity_type: 'match_accepted',
        related_user_id: userId === match.user_id_1 ? match.user_id_2 : match.user_id_1
      });

    return {
      id: conversation.id,
      matchId: conversation.match_id,
      userId1: conversation.user_id_1,
      userId2: conversation.user_id_2,
      conversationStarter: conversation.conversation_starter,
      status: conversation.status,
      createdAt: new Date(conversation.created_at)
    };
  } catch (error) {
    console.error('Error accepting match:', error);
    return null;
  }
};

/**
 * Declines a match
 */
export const declineMatch = async (matchId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_matches')
      .update({ status: 'declined' })
      .eq('id', matchId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (!error) {
      // Log activity
      await supabase
        .from('networking_activity')
        .insert({
          user_id: userId,
          activity_type: 'match_declined'
        });
    }

    return !error;
  } catch (error) {
    console.error('Error declining match:', error);
    return false;
  }
};

/**
 * Gets networking conversations for a user
 */
export const getNetworkingConversations = async (userId: string): Promise<NetworkingConversation[]> => {
  try {
    const { data: conversations, error } = await supabase
      .from('networking_conversations')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error || !conversations) return [];

    return conversations.map(conv => ({
      id: conv.id,
      matchId: conv.match_id,
      userId1: conv.user_id_1,
      userId2: conv.user_id_2,
      conversationStarter: conv.conversation_starter,
      status: conv.status,
      lastMessageAt: conv.last_message_at ? new Date(conv.last_message_at) : undefined,
      createdAt: new Date(conv.created_at)
    }));
  } catch (error) {
    console.error('Error getting networking conversations:', error);
    return [];
  }
};

/**
 * Sends a message in a networking conversation
 */
export const sendNetworkingMessage = async (
  conversationId: string,
  senderId: string,
  content: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('networking_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: 'text'
      });

    if (!error) {
      // Update conversation last message time
      await supabase
        .from('networking_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', conversationId);

      // Log activity
      await supabase
        .from('networking_activity')
        .insert({
          user_id: senderId,
          activity_type: 'message_sent'
        });
    }

    return !error;
  } catch (error) {
    console.error('Error sending networking message:', error);
    return false;
  }
};

/**
 * Gets messages for a networking conversation
 */
export const getNetworkingMessages = async (conversationId: string) => {
  try {
    const { data: messages, error } = await supabase
      .from('networking_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return { messages: messages || [], error };
  } catch (error) {
    console.error('Error getting networking messages:', error);
    return { messages: [], error };
  }
};

/**
 * Updates user networking preferences
 */
export const updateNetworkingPreferences = async (
  userId: string,
  preferences: Partial<{
    isNetworkingEnabled: boolean;
    visibilityLevel: 'public' | 'limited' | 'private';
    maxMatchesPerDay: number;
    preferredCommunicationStyles: string[];
    minimumCompatibilityScore: number;
  }>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_networking_preferences')
      .upsert({
        user_id: userId,
        is_networking_enabled: preferences.isNetworkingEnabled,
        visibility_level: preferences.visibilityLevel,
        max_matches_per_day: preferences.maxMatchesPerDay,
        preferred_communication_styles: preferences.preferredCommunicationStyles,
        minimum_compatibility_score: preferences.minimumCompatibilityScore
      });

    return !error;
  } catch (error) {
    console.error('Error updating networking preferences:', error);
    return false;
  }
};
