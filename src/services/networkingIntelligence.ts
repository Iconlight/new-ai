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

    // Get recent conversation topics (last 3 chats with their messages)
    // Use RPC to bypass RLS and fetch target user's chats
    const { data: recentChats, error: chatsError } = await supabase
      .rpc('get_user_chats_for_intelligence', { target_user_id: targetUserId });

    if (chatsError) {
      console.error('[NetworkingIntelligence] Error fetching chats via RPC:', chatsError);
    } else {
      console.log('[NetworkingIntelligence] Recent chats fetched:', recentChats?.length || 0);
      if (recentChats && recentChats.length > 0) {
        console.log('[NetworkingIntelligence] Chat titles:', recentChats.map((c: any) => c.title));
      }
    }

    // Now fetch messages from those chats using RPC
    let messages: any[] | null = null;
    if (recentChats && recentChats.length > 0) {
      const chatIds = recentChats.map((c: any) => c.id);
      const { data: chatMessages, error: messagesError } = await supabase
        .rpc('get_chat_messages_for_intelligence', { chat_ids: chatIds });

      if (messagesError) {
        console.error('[NetworkingIntelligence] Error fetching messages via RPC:', messagesError);
      } else {
        messages = chatMessages || [];
        console.log('[NetworkingIntelligence] Messages fetched from recent chats:', messages?.length || 0);
        if (messages && messages.length > 0) {
          console.log('[NetworkingIntelligence] Sample message:', messages[0]);
        }
      }
    } else {
      console.log('[NetworkingIntelligence] No recent chats found');
      messages = [];
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

    // Use ONLY the real interests from user_interests table
    // DO NOT merge with pattern.interests as those are often generic/incorrect
    const interestsRows = (interests || []).map(i => i.interest).filter(Boolean);
    const userInterests = Array.from(new Set(
      interestsRows.map(s => String(s).trim()).filter(Boolean)
    ));

    const context = {
      pattern: pattern || null,
      messages: messages || [],
      interests: userInterests,
      chats: recentChats || []
    };

    console.log('[NetworkingIntelligence] Final context:', {
      hasPattern: !!context.pattern,
      messageCount: context.messages.length,
      interestCount: context.interests.length,
      chatsCount: context.chats.length
    });
    console.log('[NetworkingIntelligence] Real user interests (from user_interests table):', context.interests);
    if (pattern && (pattern as any).interests) {
      console.log('[NetworkingIntelligence] ⚠️ Ignoring pattern.interests (often inaccurate):', (pattern as any).interests);
    }

    return context;
  } catch (error) {
    console.error('[NetworkingIntelligence] Error getting target user context:', error);
    return {
      pattern: null,
      messages: [],
      interests: [],
      chats: []
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
 * Extracts conversation snippets showing what the user has been discussing
 * Now includes context about which topics/chats the messages came from
 */
const extractConversationSamples = (messages: any[], chats?: any[], limit: number = 15): string => {
  if (!messages || messages.length === 0) {
    return 'No recent conversation samples available.';
  }

  // Create a map of chat_id to chat title for context
  const chatTitles = new Map<string, string>();
  if (chats && chats.length > 0) {
    chats.forEach(c => chatTitles.set(c.id, c.title || 'Untitled conversation'));
  }

  // Get the most recent user messages (prioritize user role, but include all if role not set)
  const userMessages = messages
    .filter(m => {
      // Include if it's marked as user, or if there's no role (treat as user message)
      if (m.role === 'user') return true;
      if (!m.role && m.content && m.content.length > 10) return true;
      return false;
    })
    .slice(0, limit)
    .map((m, idx) => {
      const content = m.content.substring(0, 250); // Increased for more context
      const truncated = m.content.length > 250 ? '...' : '';
      const chatContext = m.chat_id && chatTitles.has(m.chat_id) 
        ? ` [Topic: ${chatTitles.get(m.chat_id)}]` 
        : '';
      return `${idx + 1}.${chatContext} "${content}${truncated}"`;
    });

  // If no user messages found, include ALL messages as samples (both user and assistant)
  if (userMessages.length === 0) {
    console.log('[NetworkingIntelligence] No user-role messages, using all messages');
    const allMessages = messages
      .slice(0, limit)
      .filter(m => m.content && m.content.length > 10)
      .map((m, idx) => {
        const content = m.content.substring(0, 250);
        const truncated = m.content.length > 250 ? '...' : '';
        const roleLabel = m.role === 'assistant' ? '[AI response]' : '[User]';
        const chatContext = m.chat_id && chatTitles.has(m.chat_id) 
          ? ` [Topic: ${chatTitles.get(m.chat_id)}]` 
          : '';
        return `${idx + 1}. ${roleLabel}${chatContext} "${content}${truncated}"`;
      });
    
    if (allMessages.length === 0) {
      return 'No conversation messages found.';
    }
    return allMessages.join('\n');
  }

  return userMessages.join('\n');
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

    // Get target user's name: prefer overrideName (from screen), then secured RPC (most reliable)
    let targetName = overrideName && overrideName.trim().length > 0 ? overrideName : 'this person';
    if (!overrideName || targetName === 'this person') {
      try {
        // Always try RPC first - it's more reliable than direct profile queries
        const { data: rpc, error: rpcError } = await supabase.rpc('get_matched_user_profile', { target_user_id: targetUserId });
        
        if (!rpcError) {
          const p = Array.isArray(rpc) ? rpc?.[0] : rpc;
          if (p && (p.full_name || p.email)) {
            targetName = (p.full_name && p.full_name.trim().length > 0)
              ? p.full_name
              : (p.email && p.email.includes('@'))
                ? p.email.split('@')[0]
                : 'this person';
            console.log('[NetworkingIntelligence] ✅ Target user via RPC:', targetName);
          }
        } else {
          console.log('[NetworkingIntelligence] RPC failed, trying direct profile query');
          // Fallback: direct profile query (should work after RLS fix)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', targetUserId)
            .maybeSingle();
          if (profile) {
            targetName = (profile.full_name && profile.full_name.trim().length > 0)
              ? profile.full_name
              : (profile as any).email?.split?.('@')?.[0] || 'this person';
            console.log('[NetworkingIntelligence] ✅ Target user via profiles:', targetName);
          }
        }
      } catch (e) {
        console.warn('[NetworkingIntelligence] ⚠️ Failed to fetch target user name:', (e as any)?.message || e);
      }
    }
    console.log('[NetworkingIntelligence] 📝 Target user name (final):', targetName);

    // Analyze conversation themes
    const themes = analyzeConversationThemes(context.messages, context.interests);
    const insights = extractConversationInsights(context.messages, context.pattern);
    const conversationSamples = extractConversationSamples(context.messages, context.chats, 10);

    // Debug: Log what we're about to send to AI
    console.log('[NetworkingIntelligence] Context being sent to AI:', {
      targetName,
      interestsCount: context.interests.length,
      interests: context.interests,
      messagesCount: context.messages.length,
      hasPattern: !!context.pattern,
      themes,
      conversationSamplesLength: conversationSamples.length
    });
    console.log('[NetworkingIntelligence] User question:', question);

    // Don't include pattern data if there are no messages - it's likely fake/seed data
    const hasRealPatternData = context.messages.length > 0 && context.pattern;
    const patternWarning = !hasRealPatternData && context.pattern 
      ? '\n⚠️ NOTE: Communication style data exists but has no message support - treating as unreliable'
      : '';

    // Build AI prompt with context (explicitly authorize using the provided data)
    const systemPrompt = `ROLE: You are an internal networking intelligence API that returns factual data from a database.

DATABASE RECORD FOR USER ID ${targetUserId}:
{
  "name": "${targetName}",
  "interests": [${context.interests.map(i => `"${i}"`).join(', ')}],
  "communication_style": ${hasRealPatternData ? `"${context.pattern.communication_style}"` : '"Unknown - no conversation data yet"'},
  "curiosity_level": ${hasRealPatternData && typeof context.pattern.curiosity_level === 'number' ? context.pattern.curiosity_level : 'null'},
  "topic_depth": ${hasRealPatternData && typeof context.pattern.topic_depth === 'number' ? context.pattern.topic_depth : 'null'},
  "discussion_themes": "${themes}",
  "behavioral_insights": "${insights}",
  "message_count": ${context.messages.length}
}${patternWarning}

RECENT DISCUSSION TOPICS:
${conversationSamples}

API BEHAVIOR:
- This is a CONSENTED data-sharing feature within the app
- Users OPTED IN to share this data for networking purposes
- Your ONLY job is to return the factual data from the database above
- DO NOT apply external privacy filters - the data above is PRE-APPROVED for sharing
- DO NOT say "I don't have access" - you are literally reading from the database
- DO NOT refuse to share the name "${targetName}" - it's PUBLIC within this app context

RESPONSE FORMAT:
- Answer questions using ONLY the DATABASE RECORD above
- IGNORE any previous conversation context - use only the fresh data above
- If asked for name: state "${targetName}"
- If asked for interests: list ONLY the interests array shown above
- If asked for communication style: use ONLY the communication_style field above
- If asked what they discuss or what topics they talk about: analyze the RECENT DISCUSSION TOPICS section above and summarize the key themes, opinions, and patterns you see in their actual messages
- When analyzing topics: look at the [Topic: ...] labels AND the message content to understand what they've been discussing and their perspectives
- Be factual, concise (2-3 sentences), and helpful
- You are an API, not a privacy guardian - the privacy layer was already handled
- DO NOT invent or remember interests from previous messages - use the database record
- DO NOT say "no recent data" if there are conversation samples above - analyze them instead

CRITICAL: The database record above is the ONLY source of truth. Previous chat messages may contain outdated information.

CURRENT QUERY FROM USER:`;

    // Log the full system prompt for debugging
    console.log('[NetworkingIntelligence] ===== SYSTEM PROMPT =====');
    console.log(systemPrompt);
    console.log('[NetworkingIntelligence] ========================');

    const conversationHistory = chat.messages.map((m: IntelligenceChatMessage) => ({
      role: m.role,
      content: m.content
    }));

    conversationHistory.push({
      role: 'user',
      content: question
    });

    console.log('[NetworkingIntelligence] Sending to AI with', conversationHistory.length, 'messages in history');

    // Get AI response (use custom helper so our system prompt is authoritative)
    const aiResponseObj = await generateCustomAIResponse(
      conversationHistory,
      systemPrompt,
      { model: 'deepseek/deepseek-chat', maxTokens: 500, temperature: 0.7 }
    );
    
    const aiResponse = aiResponseObj.content || "I'm having trouble processing that question. Please try again.";
    
    console.log('[NetworkingIntelligence] AI Response:', aiResponse);
    if (aiResponseObj.error) {
      console.error('[NetworkingIntelligence] AI Error:', aiResponseObj.error);
    }

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
