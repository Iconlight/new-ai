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
  conversationId?: string;
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
    interests: string[];
    communicationStyle: string;
  };
}

// Helper to compute display name
const toDisplayName = (full_name?: string | null, email?: string | null, fallback: string = 'User') => {
  if (full_name && full_name.trim().length > 0) return full_name;
  if (email && email.includes('@')) return email.split('@')[0];
  return fallback;
};

// Robust profile fetch with multiple fallbacks
const fetchDisplayProfile = async (otherUserId: string, conversationId?: string) => {
  try {
    // 1) Conversation-based RPC (best when we have a conversation)
    if (conversationId) {
      const { data: rpcConv } = await supabase.rpc('get_conversation_peer_profile', { conversation_id: conversationId });
      const p1 = Array.isArray(rpcConv) ? rpcConv[0] : rpcConv;
      if (p1 && (p1.full_name || p1.email)) {
        return { name: toDisplayName(p1.full_name, p1.email), avatar: p1.avatar_url as string | undefined };
      }
    }

    // 2) Match-based RPC
    const { data: rpcMatch } = await supabase.rpc('get_matched_user_profile', { target_user_id: otherUserId });
    const p2 = Array.isArray(rpcMatch) ? rpcMatch[0] : rpcMatch;
    if (p2 && (p2.full_name || p2.email)) {
      return { name: toDisplayName(p2.full_name, p2.email), avatar: p2.avatar_url as string | undefined };
    }

    // 3) Direct select from profiles (RLS should allow if matched or in conversation)
    const { data: p3 } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', otherUserId)
      .maybeSingle();
    if (p3) {
      return { name: toDisplayName(p3.full_name, p3.email), avatar: (p3 as any).avatar_url as string | undefined };
    }
  } catch (e) {
    console.warn('[Networking] fetchDisplayProfile error:', (e as any)?.message || e);
  }
  return { name: 'User', avatar: undefined };
};

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
 * Ensures a user has conversation patterns analyzed, creates basic ones if missing
 */
const ensureUserHasConversationPattern = async (userId: string): Promise<void> => {
  try {
    // Check if user already has patterns
    const { data: existingPattern } = await supabase
      .from('user_conversation_patterns')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPattern) {
      console.log('✅ User already has conversation pattern');
      return;
    }

    console.log('🔄 Creating conversation pattern for user...');

    // Get user's interests
    const { data: userInterests } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', userId);

    const interests = userInterests?.map(ui => ui.interest) || ['technology', 'science'];

    // Count user's messages to determine communication style
    // First, get the user's chat IDs
    const { data: userChats } = await supabase
      .from('chats')
      .select('id')
      .eq('user_id', userId);
    
    const chatIds = userChats?.map(chat => chat.id) || [];
    
    // Then count messages in those chats (only if user has chats)
    let messageCount = 0;
    if (chatIds.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user')
        .in('chat_id', chatIds);
      messageCount = count || 0;
    }

    // Determine communication style based on user ID for consistency
    const communicationStyles = ['analytical', 'creative', 'empathetic', 'direct', 'philosophical'];
    const userIdHash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const style = communicationStyles[userIdHash % communicationStyles.length];

    // Create basic conversation pattern
    const { error } = await supabase
      .from('user_conversation_patterns')
      .insert({
        user_id: userId,
        communication_style: style,
        curiosity_level: 70 + Math.floor(Math.random() * 30), // 70-100
        topic_depth: 60 + Math.floor(Math.random() * 40), // 60-100
        question_asking: 50 + Math.floor(Math.random() * 40), // 50-90
        response_length: ['concise', 'moderate', 'detailed'][Math.floor(Math.random() * 3)],
        interests: interests,
        conversation_topics: interests,
        intellectual_curiosity: 65 + Math.floor(Math.random() * 35), // 65-100
        emotional_intelligence: 60 + Math.floor(Math.random() * 40) // 60-100
      });

    if (error) {
      console.error('❌ Error creating conversation pattern:', error);
    } else {
      console.log(`✅ Created conversation pattern: ${style} style with ${interests.length} interests`);
    }
  } catch (error) {
    console.error('Error ensuring conversation pattern:', error);
  }
};

/**
 * Finds new matches for a user based on their conversation patterns
 */
export const findNewMatches = async (userId: string): Promise<NetworkingMatch[]> => {
  try {
    console.log('🔍 Finding new matches for user:', userId);
    
    // Ensure user has conversation patterns analyzed
    await ensureUserHasConversationPattern(userId);
    
    // Check if user has networking enabled
    const { data: preferences } = await supabase
      .from('user_networking_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('is_networking_enabled', true)
      .single();

    if (!preferences) {
      console.log('❌ User networking not enabled or preferences not found');
      return [];
    }

    console.log('✅ User networking preferences:', preferences);

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
    
    console.log(`🎯 Found ${compatibilities.length} compatible users from analysis`);
    
    // Filter out existing matches and blocked users
    const { data: existingMatches } = await supabase
      .from('user_matches')
      .select('user_id_2')
      .eq('user_id_1', userId);

    const existingMatchIds = new Set(existingMatches?.map(m => m.user_id_2) || []);
    const blockedUsers = new Set(preferences.blocked_users || []);

    console.log(`🔒 Existing matches: ${existingMatchIds.size}, Blocked: ${blockedUsers.size}`);
    console.log(`⚙️ Minimum compatibility score from preferences: ${preferences.minimum_compatibility_score}`);

    // Lower threshold for testing - change back to original for production
    const effectiveMinScore = Math.min(preferences.minimum_compatibility_score, 40);
    console.log(`📊 Using effective minimum score: ${effectiveMinScore} (lowered for testing)`);

    const newCompatibilities = compatibilities.filter(comp => {
      const passesScore = comp.compatibilityScore >= effectiveMinScore;
      const notExisting = !existingMatchIds.has(comp.userId2);
      const notBlocked = !blockedUsers.has(comp.userId2);
      
      console.log(`  User ${comp.userId2}: score=${comp.compatibilityScore}, passes=${passesScore && notExisting && notBlocked}`);
      
      return notExisting && notBlocked && passesScore;
    });

    console.log(`✅ ${newCompatibilities.length} new compatible users after filtering`);

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

        // Fetch other user's display profile (name/avatar) with fallbacks
        const display = await fetchDisplayProfile(comp.userId2);

        // If conversation already exists for this match (edge cases), fetch id
        const { data: existingConv } = await supabase
          .from('networking_conversations')
          .select('id')
          .eq('match_id', match.id)
          .maybeSingle();

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
          conversationId: existingConv?.id,
          otherUser: {
            id: comp.userId2,
            name: display.name,
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
      } else if (error) {
        console.error(`❌ Error creating match with ${comp.userId2}:`, error);
      }
    }

    console.log(`🎉 Created ${matches.length} new matches in database`);
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
    console.log('🔍 Fetching user matches for:', userId);
    
    // First, let's test if the table exists with a simple query
    const { data: testData, error: testError } = await supabase
      .from('user_matches')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ user_matches table test failed:', testError);
      
      // Fallback: Try to get matches from networking_activity table (old approach)
      console.log('🔄 Falling back to networking_activity table...');
      return await getMatchesFromActivity(userId);
    }
    
    console.log('✅ user_matches table accessible');
    
    const { data: matches, error } = await supabase
      .from('user_matches')
      .select(`
        *
      `)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .neq('status', 'declined') // Hide declined connections
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user matches:', error);
      return await getMatchesFromActivity(userId);
    }

    console.log(`Found ${matches.length} matches for user ${userId}`);

    const enriched = await Promise.all(matches.map(async (match: any) => {
      const otherId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;
      console.log(`Processing match ${match.id} with user ${otherId}, status: ${match.status}`);

      // Fetch conversation if exists
      const { data: conv, error: convError } = await supabase
        .from('networking_conversations')
        .select('id, status')
        .eq('match_id', match.id)
        .maybeSingle();

      if (convError) {
        console.warn(`⚠️ Error fetching conversation for match ${match.id}:`, convError);
      }

      console.log(`💬 Conversation for match ${match.id}:`, conv ? `ID: ${conv.id}, Status: ${conv.status}` : 'None');

      // Fetch other user's profile and style
      const [{ data: pattern, error: patternError }, display] = await Promise.all([
        supabase.from('user_conversation_patterns').select('communication_style, interests').eq('user_id', otherId).maybeSingle(),
        fetchDisplayProfile(otherId, conv?.id)
      ]);
      
      if (patternError) {
        console.warn(`⚠️ Error fetching pattern for user ${otherId}:`, patternError);
      }
      
      console.log(`👤 User ${otherId} pattern:`, {
        style: pattern?.communication_style || 'none',
        interests: pattern?.interests || 'none',
        hasPattern: !!pattern
      });

      const nm: NetworkingMatch = {
        id: match.id,
        userId1: match.user_id_1,
        userId2: match.user_id_2,
        compatibilityScore: match.compatibility_score || 75,
        sharedInterests: match.shared_interests || [],
        matchReason: match.match_reason || 'Compatible conversation styles',
        status: match.status,
        createdAt: new Date(match.created_at),
        expiresAt: new Date(match.expires_at || Date.now() + 7 * 24 * 60 * 60 * 1000),
        conversationId: conv?.id,
        otherUser: {
          id: otherId,
          name: display.name,
          avatar: display.avatar,
          interests: pattern?.interests || match.shared_interests || [],
          communicationStyle: pattern?.communication_style || 'analytical'
        }
      };
      
      console.log(`✅ Processed match: ${nm.otherUser.name} (${nm.status}) - ${conv ? 'Has conversation' : 'No conversation'}`);
      return nm;
    }));

    return enriched;
  } catch (error) {
    console.error('Error getting user matches:', error);
    return [];
  }
};

/**
 * Fetch conversation id by match id
 */
export const getConversationIdByMatchId = async (matchId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('networking_conversations')
      .select('id')
      .eq('match_id', matchId)
      .maybeSingle();
    if (error) return null;
    return data?.id || null;
  } catch {
    return null;
  }
};

/**
 * Get conversation info including the other user's name for the given viewer
 */
export const getNetworkingConversationInfo = async (
  conversationId: string,
  viewerUserId: string
): Promise<{ otherUserId: string; otherUserName: string } | null> => {
  try {
    const { data: conv, error } = await supabase
      .from('networking_conversations')
      .select('user_id_1, user_id_2')
      .eq('id', conversationId)
      .single();
    if (error || !conv) return null;
    const otherId = conv.user_id_1 === viewerUserId ? conv.user_id_2 : conv.user_id_1;
    const display = await fetchDisplayProfile(otherId, conversationId);
    return {
      otherUserId: otherId,
      otherUserName: display?.name || 'Connection'
    };
  } catch {
    return null;
  }
};

/**
 * Accepts a match and creates a networking conversation
 */
export const acceptMatch = async (matchId: string, userId: string): Promise<NetworkingConversation | null> => {
  try {
    console.log(`🤝 Accepting match ${matchId} by user ${userId}`);
    
    // Update match status
    const { data: match, error: matchError } = await supabase
      .from('user_matches')
      .update({ status: 'accepted' })
      .eq('id', matchId)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .select()
      .single();

    if (matchError) {
      console.error('❌ Error updating match status:', matchError);
      return null;
    }
    
    if (!match) {
      console.error('❌ Match not found or user not authorized');
      return null;
    }

    console.log('✅ Match status updated to accepted:', match);

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

    // Add starter message as the accepting user to satisfy RLS (auth.uid() = sender_id)
    await supabase
      .from('networking_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        content: conversationStarter,
        message_type: 'starter'
      });

    // Update last message timestamp
    await supabase
      .from('networking_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

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
    console.log(`📤 Sending networking message:`, {
      conversationId,
      senderId,
      contentLength: content.length,
      content: content.substring(0, 50) + '...'
    });

    const { data, error } = await supabase
      .from('networking_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_type: 'text'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error inserting networking message:', error);
      return false;
    }

    console.log('✅ Message inserted successfully:', data.id);

    if (data) {
      // Note: Push notifications are now handled automatically by database trigger
      // See: src/database/migrations/add_message_notification_trigger.sql
      // The trigger calls the Edge Function: supabase/functions/send-message-notification

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
    console.log('Updating networking preferences for user:', userId, preferences);
    
    // Build the update object with only defined values
    const updateData: any = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };
    
    if (preferences.isNetworkingEnabled !== undefined) {
      updateData.is_networking_enabled = preferences.isNetworkingEnabled;
    }
    if (preferences.visibilityLevel !== undefined) {
      updateData.visibility_level = preferences.visibilityLevel;
    }
    if (preferences.maxMatchesPerDay !== undefined) {
      updateData.max_matches_per_day = preferences.maxMatchesPerDay;
    }
    if (preferences.preferredCommunicationStyles !== undefined) {
      updateData.preferred_communication_styles = preferences.preferredCommunicationStyles;
    }
    if (preferences.minimumCompatibilityScore !== undefined) {
      updateData.minimum_compatibility_score = preferences.minimumCompatibilityScore;
    }

    const { data, error } = await supabase
      .from('user_networking_preferences')
      .upsert(updateData, {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      console.error('Supabase error updating networking preferences:', error);
      return false;
    }
    
    console.log('Successfully updated networking preferences:', data);
    return true;
  } catch (error) {
    console.error('Error updating networking preferences:', error);
    return false;
  }
};

/**
 * Fallback function to get matches from networking_activity table (legacy approach)
 */
const getMatchesFromActivity = async (userId: string): Promise<NetworkingMatch[]> => {
  try {
    console.log('🔄 Using networking_activity fallback for user:', userId);
    
    // Get networking activities where user was matched
    const { data: activities, error } = await supabase
      .from('networking_activity')
      .select('*')
      .eq('user_id', userId)
      .in('activity_type', ['match_found', 'match_accepted'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching networking activities:', error);
      return [];
    }

    if (!activities || activities.length === 0) {
      console.log('No networking activities found');
      return [];
    }

    // Convert activities to match format
    const matches: NetworkingMatch[] = [];
    for (const activity of activities) {
      if (activity.related_user_id && activity.related_user_id !== userId) {
        const profile = await fetchDisplayProfile(activity.related_user_id);
        
        matches.push({
          id: activity.id,
          userId1: userId,
          userId2: activity.related_user_id,
          compatibilityScore: activity.metadata?.compatibility_score || 75,
          sharedInterests: activity.metadata?.shared_interests || [],
          matchReason: activity.metadata?.match_reason || 'Compatible conversation styles',
          status: activity.activity_type === 'match_accepted' ? 'accepted' : 'pending',
          createdAt: new Date(activity.created_at),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          otherUser: {
            id: activity.related_user_id,
            name: profile.name,
            avatar: profile.avatar,
            interests: activity.metadata?.interests || [],
            communicationStyle: activity.metadata?.communication_style || 'analytical'
          }
        });
      }
    }

    console.log(`✅ Found ${matches.length} matches from networking_activity`);
    return matches;
  } catch (error) {
    console.error('Error in getMatchesFromActivity:', error);
    return [];
  }
};

// Note: Push notification function removed - now handled by database trigger
// See: src/database/migrations/add_message_notification_trigger.sql
// The trigger automatically calls: supabase/functions/send-message-notification
