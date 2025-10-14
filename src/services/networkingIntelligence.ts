import { supabase } from './supabase';
import { generateAIResponse } from './ai';

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
    // Get conversation pattern
    const { data: pattern } = await supabase
      .from('user_conversation_patterns')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // Get recent conversation topics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: messages } = await supabase
      .from('messages')
      .select(`
        content,
        created_at,
        chats!inner(user_id, title)
      `)
      .eq('chats.user_id', targetUserId)
      .eq('role', 'user')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get user's interests
    const { data: interests } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', targetUserId);

    return {
      pattern: pattern || null,
      messages: messages || [],
      interests: interests?.map(i => i.interest) || []
    };
  } catch (error) {
    console.error('Error getting target user context:', error);
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
const analyzeConversationThemes = (messages: any[]): string => {
  if (!messages || messages.length === 0) {
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
const extractConversationInsights = (messages: any[]): string => {
  if (!messages || messages.length === 0) {
    return 'Limited conversation history available.';
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
  question: string
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

    // Get target user's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', targetUserId)
      .single();

    const targetName = profile?.full_name || 'this person';

    // Analyze conversation themes
    const themes = analyzeConversationThemes(context.messages);
    const insights = extractConversationInsights(context.messages);

    // Build AI prompt with context
    const systemPrompt = `You are a networking intelligence assistant helping a user learn about a potential connection named ${targetName}.

CONTEXT ABOUT ${targetName.toUpperCase()}:

Communication Style: ${context.pattern?.communication_style || 'Not yet analyzed'}
Interests: ${context.interests.length > 0 ? context.interests.join(', ') : 'Not specified'}
Curiosity Level: ${context.pattern?.curiosity_level || 'Unknown'}/100
Topic Depth Preference: ${context.pattern?.topic_depth || 'Unknown'}/100
Response Style: ${context.pattern?.response_length || 'Unknown'}

RECENT CONVERSATION THEMES:
${themes}

CONVERSATION INSIGHTS:
${insights}

CONVERSATION SAMPLE SIZE: ${context.messages.length} messages analyzed

GUIDELINES:
1. Answer questions about ${targetName}'s interests, perspectives, and conversation patterns
2. Base answers on their conversation history and patterns - be specific when data supports it
3. Be respectful and encouraging - focus on intellectual compatibility
4. If asked about something not in the data, honestly say you don't have enough information
5. Keep responses conversational and helpful (2-4 sentences typically)
6. Encourage connection if there's genuine compatibility
7. Use natural, friendly language

PRIVACY BOUNDARIES:
- Don't reveal personal information (location, work details, contact info)
- Don't quote exact messages verbatim
- Don't discuss emotional/vulnerable topics
- Summarize themes and perspectives, not specific conversations
- Focus on intellectual interests and communication style
- If asked about private matters, politely redirect to connecting directly

TONE: Helpful, insightful, encouraging, and respectful.

Answer the user's question naturally and helpfully based on the available data.`;

    const conversationHistory = chat.messages.map((m: IntelligenceChatMessage) => ({
      role: m.role,
      content: m.content
    }));

    conversationHistory.push({
      role: 'user',
      content: question
    });

    // Get AI response
    const aiResponse = await generateAIResponse(
      conversationHistory,
      systemPrompt
    );

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

    await supabase
      .from('networking_intelligence_chats')
      .update({ messages: updatedMessages })
      .eq('id', chatId);

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
