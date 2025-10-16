import { supabase } from './supabase';
import { generateCustomAIResponse } from './ai';

export interface IntelligenceChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface IntelligenceChat {
  id: string;
  userId: string;
  targetUserId: string;
  matchId: string;
  messages: IntelligenceChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new AI intelligence chat session for a match
 */
export const createIntelligenceChat = async (
  userId: string,
  targetUserId: string,
  matchId: string,
  targetUserName: string
): Promise<string> => {
  const initialMessage: IntelligenceChatMessage = {
    role: 'assistant',
    content: `Hi! I can help you learn about ${targetUserName} based on their conversation patterns and interests. What would you like to know?`,
    timestamp: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('networking_intelligence_chats')
    .insert({
      user_id: userId,
      target_user_id: targetUserId,
      match_id: matchId,
      messages: [initialMessage]
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating intelligence chat:', error);
    throw error;
  }
  
  return data.id;
};

/**
 * Gets the target user's conversation context for AI analysis
 */
const getTargetUserContext = async (targetUserId: string) => {
  try {
    console.log('[NetworkingIntelligence] Fetching context for user:', targetUserId);
    
    // Get conversation pattern
    const { data: pattern, error: patternError } = await supabase
      .from('user_conversation_patterns')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (patternError) {
      console.error('[NetworkingIntelligence] Error fetching pattern:', patternError);
    } else {
      console.log('[NetworkingIntelligence] Pattern data:', pattern ? 'Found' : 'Not found');
      if (pattern) {
        console.log('[NetworkingIntelligence] Pattern details:', {
          style: pattern.communication_style,
          interests: pattern.interests?.length || 0,
          curiosity: pattern.curiosity_level
        });
      }
    }

    // Get recent conversation topics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let messages: any[] | null = null;
    let messagesError: any = null;
    const recentRes = await supabase
      .from('messages')
      .select(`
        content,
        created_at,
        chats!inner(user_id, title)
      `)
      .eq('chats.user_id', targetUserId)
      .in('role', ['user','assistant'])
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100);
    messages = recentRes.data as any[] | null;
    messagesError = recentRes.error;

    if (messagesError) {
      console.error('[NetworkingIntelligence] Error fetching messages:', messagesError);
    } else {
      console.log('[NetworkingIntelligence] Messages fetched (30d window):', messages?.length || 0);
      // Fallback: if no messages in 30d, try older history (no date filter, larger limit)
      if (!messages || messages.length === 0) {
        const olderRes = await supabase
          .from('messages')
          .select(`
            content,
            created_at,
            chats!inner(user_id, title)
          `)
          .eq('chats.user_id', targetUserId)
          .in('role', ['user','assistant'])
          .order('created_at', { ascending: false })
          .limit(200);
        if (olderRes.error) {
          console.error('[NetworkingIntelligence] Error fetching older messages:', olderRes.error);
        } else {
          messages = olderRes.data as any[] | null;
          console.log('[NetworkingIntelligence] Messages fetched (all-time fallback):', messages?.length || 0);
        }
      }
    }

    // Get user's interests
    const { data: interests, error: interestsError } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', targetUserId);

    if (interestsError) {
      console.error('[NetworkingIntelligence] Error fetching interests:', interestsError);
    } else {
      console.log('[NetworkingIntelligence] Interests fetched:', interests?.length || 0, interests?.map(i => i.interest));
    }

    // Merge interests from pattern and user_interests
    const patternInterests: string[] = Array.isArray((pattern as any)?.interests)
      ? ((pattern as any).interests as string[])
      : [];
    const interestsRows = (interests || []).map(i => i.interest).filter(Boolean);
    const mergedInterests = Array.from(new Set([...
      patternInterests.map(s => String(s).trim()).filter(Boolean),
      ...interestsRows.map(s => String(s).trim()).filter(Boolean)
    ]));

    const context = {
      pattern: pattern || null,
      messages: messages || [],
      interests: mergedInterests
    };

    console.log('[NetworkingIntelligence] Final context:', {
      hasPattern: !!context.pattern,
      messageCount: context.messages.length,
      interestCount: context.interests.length
    });
    if (context.interests.length) {
      console.log('[NetworkingIntelligence] Using merged interests:', context.interests);
    }

    return context;
  } catch (error) {
    console.error('[NetworkingIntelligence] Error getting target user context:', error);
    return {
      pattern: null,
      messages: [],
      interests: []
    };
  }
};

/**
 * Analyzes conversation messages to extract themes and topics
 */
const analyzeConversationThemes = (messages: any[], fallbackInterests?: string[]): string => {
  if (!messages || messages.length === 0) {
    if (fallbackInterests && fallbackInterests.length > 0) {
      return `Likely topics based on interests: ${fallbackInterests.slice(0, 8).join(', ')}`;
    }
    return 'Not enough conversation data available yet.';
  }

  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  
  // Topic keywords for detection
  const topicKeywords: Record<string, string[]> = {
    'AI & Technology': ['ai', 'artificial intelligence', 'machine learning', 'technology', 'algorithm', 'neural', 'automation', 'software', 'coding'],
    'Philosophy': ['philosophy', 'consciousness', 'existence', 'meaning', 'ethics', 'morality', 'truth', 'reality', 'metaphysics'],
    'Science': ['science', 'research', 'study', 'experiment', 'theory', 'discovery', 'quantum', 'physics', 'biology'],
    'Business': ['business', 'startup', 'entrepreneurship', 'market', 'strategy', 'innovation', 'leadership', 'management'],
    'Health & Wellness': ['health', 'wellness', 'mental', 'fitness', 'medical', 'therapy', 'mindfulness', 'nutrition'],
    'Environment': ['climate', 'environment', 'sustainability', 'renewable', 'carbon', 'green', 'conservation'],
    'Education': ['education', 'learning', 'teaching', 'knowledge', 'university', 'school', 'pedagogy'],
    'Arts & Creativity': ['art', 'creative', 'design', 'music', 'writing', 'imagination', 'aesthetic', 'culture']
  };

  const detectedTopics: string[] = [];

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const matches = keywords.filter(kw => allText.includes(kw));
    if (matches.length >= 2) {
      detectedTopics.push(topic);
    }
  }

  if (detectedTopics.length === 0) {
    return 'Various topics across different interests.';
  }

  return detectedTopics.slice(0, 5).join(', ');
};

/**
 * Extracts key conversation insights from messages
 */
const extractConversationInsights = (messages: any[], pattern?: any): string => {
  if (!messages || messages.length === 0) {
    // Derive insights from pattern when messages are not available
    const bits: string[] = [];
    const style = pattern?.communication_style;
    const curiosity = pattern?.curiosity_level;
    const depth = pattern?.topic_depth;
    if (style) bits.push(`Communication style appears ${style}`);
    if (typeof curiosity === 'number') bits.push(`Curiosity level around ${curiosity}/100`);
    if (typeof depth === 'number') bits.push(`Prefers topic depth around ${depth}/100`);
    return bits.length ? bits.join('. ') + '.' : 'Limited conversation history available.';
  }

  const insights: string[] = [];
  
  // Analyze question frequency
  const questionCount = messages.filter(m => m.content.includes('?')).length;
  const questionRatio = questionCount / messages.length;
  
  if (questionRatio > 0.4) {
    insights.push('Asks many questions and shows high curiosity');
  } else if (questionRatio > 0.2) {
    insights.push('Asks thoughtful questions to deepen understanding');
  }

  // Analyze message depth
  const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
  
  if (avgLength > 200) {
    insights.push('Prefers detailed, in-depth discussions');
  } else if (avgLength > 100) {
    insights.push('Balances depth with conciseness');
  } else {
    insights.push('Communicates concisely and directly');
  }

  // Check for philosophical language
  const philosophicalWords = ['why', 'meaning', 'purpose', 'believe', 'think', 'perspective', 'consider'];
  const hasPhilosophical = messages.some(m => 
    philosophicalWords.some(w => m.content.toLowerCase().includes(w))
  );
  
  if (hasPhilosophical) {
    insights.push('Enjoys exploring deeper meanings and perspectives');
  }

  return insights.join('. ') + '.';
};

/**
 * Sends a question to AI about the target user
 */
export const askAboutUser = async (
  chatId: string,
  userId: string,
  targetUserId: string,
  question: string,
  overrideName?: string
): Promise<string> => {
  try {
    // Check if target user allows intelligence analysis
    const { data: prefs } = await supabase
      .from('user_networking_preferences')
      .select('allow_intelligence_analysis')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (prefs && prefs.allow_intelligence_analysis === false) {
      return "This user has opted out of intelligence analysis. You can still connect with them directly to learn more!";
    }

    // Get target user context
    const context = await getTargetUserContext(targetUserId);
    
    // Get chat history
    const { data: chat } = await supabase
      .from('networking_intelligence_chats')
      .select('messages')
      .eq('id', chatId)
      .single();

    if (!chat) throw new Error('Chat not found');

    // Get target user's name: prefer overrideName (from screen), then secured RPC, then profiles
    let targetName = overrideName && overrideName.trim().length > 0 ? overrideName : 'this person';
    if (!overrideName) {
      try {
        const { data: rpc } = await supabase.rpc('get_matched_user_profile', { target_user_id: targetUserId });
        const p = Array.isArray(rpc) ? rpc?.[0] : rpc;
        if (p && (p.full_name || p.email)) {
          targetName = (p.full_name && p.full_name.trim().length > 0)
            ? p.full_name
            : (p.email && p.email.includes('@'))
              ? p.email.split('@')[0]
              : 'this person';
          console.log('[NetworkingIntelligence] Target user via RPC:', targetName);
        } else {
          // Fallback: profiles select (RLS may allow due to match)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', targetUserId)
            .maybeSingle();
          if (profile) {
            targetName = (profile.full_name && profile.full_name.trim().length > 0)
              ? profile.full_name
              : (profile as any).email?.split?.('@')?.[0] || 'this person';
            console.log('[NetworkingIntelligence] Target user via profiles:', targetName);
          }
        }
      } catch (e) {
        console.warn('[NetworkingIntelligence] Failed to fetch target user name:', (e as any)?.message || e);
      }
    }
    console.log('[NetworkingIntelligence] Target user name (final):', targetName);

    // Analyze conversation themes
    const themes = analyzeConversationThemes(context.messages, context.interests);
    const insights = extractConversationInsights(context.messages, context.pattern);

    // Build AI prompt with context (explicitly authorize using the provided data)
    const systemPrompt = `You are a networking intelligence assistant helping a user learn about a potential connection named ${targetName}.

DATA YOU MAY USE DIRECTLY:
- Name: ${targetName}
- Interests: ${context.interests.length > 0 ? context.interests.join(', ') : 'Not specified'}
- Communication Style: ${context.pattern?.communication_style || 'Not yet analyzed'}
- Curiosity Level: ${typeof context.pattern?.curiosity_level === 'number' ? context.pattern?.curiosity_level : 'Unknown'}/100
- Topic Depth Preference: ${typeof context.pattern?.topic_depth === 'number' ? context.pattern?.topic_depth : 'Unknown'}/100
- Derived Themes: ${themes}
- Insights: ${insights}
- Conversation Sample Size: ${context.messages.length}

IMPORTANT INSTRUCTIONS:
- If the above fields are present, you DO have access to them. Use them directly.
- Do NOT say you "don’t have access" to the user's name, interests, communication style, or themes if they are listed above.
- Be specific with what is known, and say "not enough data" only for fields that are actually missing.
- Do NOT reveal personal information (location, work, contact details) and do NOT quote exact messages.
- Summarize themes and perspectives; avoid sensitive/emotional topics.
- Keep responses concise (2–4 sentences), helpful, and friendly.

When answering, ground your response in the DATA YOU MAY USE DIRECTLY.`;

    const conversationHistory = chat.messages.map((m: IntelligenceChatMessage) => ({
      role: m.role,
      content: m.content
    }));

    conversationHistory.push({
      role: 'user',
      content: question
    });

    // Get AI response (use custom helper so our system prompt is authoritative)
    const aiResponseObj = await generateCustomAIResponse(
      conversationHistory,
      systemPrompt,
      { model: 'deepseek/deepseek-chat', maxTokens: 500, temperature: 0.7 }
    );
    
    const aiResponse = aiResponseObj.content || "I'm having trouble processing that question. Please try again.";

    // Save to chat history
    const updatedMessages: IntelligenceChatMessage[] = [
      ...chat.messages,
      {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      }
    ];

    console.log('[NetworkingIntelligence] Saving', updatedMessages.length, 'messages to chat', chatId);
    const { error: updateError } = await supabase
      .from('networking_intelligence_chats')
      .update({ messages: updatedMessages })
      .eq('id', chatId);

    if (updateError) {
      console.error('[NetworkingIntelligence] Error saving messages:', updateError);
      throw updateError;
    }
    
    console.log('[NetworkingIntelligence] Messages saved successfully');

    return aiResponse;
  } catch (error) {
    console.error('Error asking about user:', error);
    throw error;
  }
};

/**
 * Gets or creates an intelligence chat
 */
export const getOrCreateIntelligenceChat = async (
  userId: string,
  targetUserId: string,
  matchId: string,
  targetUserName: string
): Promise<string> => {
  try {
    // Check if chat already exists
    const { data: existing } = await supabase
      .from('networking_intelligence_chats')
      .select('id')
      .eq('user_id', userId)
      .eq('target_user_id', targetUserId)
      .maybeSingle();

    if (existing) return existing.id;

    // Create new chat
    return await createIntelligenceChat(userId, targetUserId, matchId, targetUserName);
  } catch (error) {
    console.error('Error getting or creating intelligence chat:', error);
    throw error;
  }
};

/**
 * Gets chat messages
 */
export const getIntelligenceChatMessages = async (chatId: string): Promise<IntelligenceChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('networking_intelligence_chats')
      .select('messages')
      .eq('id', chatId)
      .single();

    if (error) throw error;
    return data?.messages || [];
  } catch (error) {
    console.error('Error getting intelligence chat messages:', error);
    return [];
  }
};

/**
 * Deletes an intelligence chat
 */
export const deleteIntelligenceChat = async (chatId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('networking_intelligence_chats')
      .delete()
      .eq('id', chatId);

    return !error;
  } catch (error) {
    console.error('Error deleting intelligence chat:', error);
    return false;
  }
};
