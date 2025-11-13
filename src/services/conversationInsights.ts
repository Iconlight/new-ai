// Conversation Insights Service
// Generates AI insights from conversations and manages outcomes

import { supabase } from './supabase';
import { generateChatResponse } from './aiService';

export interface ConversationInsight {
  takeaway: string;
  category: 'fact' | 'opinion' | 'question' | 'idea';
}

export interface ConversationOutcome {
  insights: ConversationInsight[];
  keyTopics: string[];
  conversationStyle: 'exploratory' | 'analytical' | 'creative' | 'philosophical';
  depth: number; // 1-5
  recommendedTopics: string[];
}

/**
 * Generate insights from a conversation
 */
export async function generateConversationInsights(
  chatId: string,
  userId: string
): Promise<ConversationOutcome | null> {
  try {
    // Get conversation messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error || !messages || messages.length < 5) {
      console.log('Not enough messages for insights');
      return null;
    }

    // Build conversation summary
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');

    // Generate insights using AI
    const prompt = `Analyze this conversation and provide insights:

${conversationText}

Please provide:
1. Three key takeaways (mix of facts, ideas, and questions raised)
2. Main topics discussed
3. Conversation style (exploratory, analytical, creative, or philosophical)
4. Conversation depth (1-5, where 5 is very deep)
5. Three related topics they might enjoy

Format as JSON:
{
  "insights": [
    {"takeaway": "...", "category": "fact|opinion|question|idea"}
  ],
  "keyTopics": ["topic1", "topic2"],
  "conversationStyle": "exploratory",
  "depth": 3,
  "recommendedTopics": ["topic1", "topic2", "topic3"]
}`;

    const aiResponse = await generateChatResponse(chatId, prompt, userId);
    
    // Parse AI response
    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const outcome: ConversationOutcome = JSON.parse(jsonMatch[0]);
      
      // Save to database
      await supabase
        .from('conversation_insights')
        .upsert({
          user_id: userId,
          chat_id: chatId,
          insights: outcome.insights,
          key_takeaways: outcome.insights.map(i => i.takeaway),
          topics_discussed: outcome.keyTopics,
          message_count: messages.length,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,chat_id'
        });

      return outcome;
    } catch (parseError) {
      console.error('Error parsing AI insights:', parseError);
      
      // Return fallback insights
      return {
        insights: [
          { takeaway: 'Interesting discussion about complex topics', category: 'opinion' },
          { takeaway: 'Multiple perspectives explored', category: 'idea' },
        ],
        keyTopics: ['general discussion'],
        conversationStyle: 'exploratory',
        depth: 3,
        recommendedTopics: [],
      };
    }
  } catch (error) {
    console.error('Error generating conversation insights:', error);
    return null;
  }
}

/**
 * Get saved insights for a conversation
 */
export async function getConversationInsights(
  chatId: string,
  userId: string
): Promise<ConversationOutcome | null> {
  try {
    const { data, error } = await supabase
      .from('conversation_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('chat_id', chatId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      insights: data.insights as ConversationInsight[],
      keyTopics: data.topics_discussed || [],
      conversationStyle: 'exploratory', // Could be stored in DB
      depth: Math.min(5, Math.floor(data.message_count / 5)),
      recommendedTopics: [],
    };
  } catch (error) {
    console.error('Error getting conversation insights:', error);
    return null;
  }
}

/**
 * Find related topics based on conversation
 */
export async function findRelatedTopics(
  keywords: string[],
  userId: string
): Promise<any[]> {
  try {
    // Get topics from feed that match keywords
    const { data, error } = await supabase
      .from('proactive_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('is_sent', false)
      .limit(5);

    if (error || !data) {
      return [];
    }

    // Filter by keyword relevance
    const related = data.filter(topic => {
      const topicText = `${topic.topic} ${topic.message}`.toLowerCase();
      return keywords.some(keyword => 
        topicText.includes(keyword.toLowerCase())
      );
    });

    return related;
  } catch (error) {
    console.error('Error finding related topics:', error);
    return [];
  }
}

/**
 * Check if conversation is ready for insights
 * (10+ messages or user is leaving)
 */
export function shouldShowInsights(messageCount: number, isExiting: boolean): boolean {
  return messageCount >= 10 || (messageCount >= 5 && isExiting);
}

/**
 * Track insight actions
 */
export async function trackInsightAction(
  userId: string,
  chatId: string,
  action: 'shared' | 'found_related' | 'continued_networking' | 'dismissed'
): Promise<void> {
  try {
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'conversation_insight_action',
        user_id: userId,
        properties: {
          chatId,
          action,
        },
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error tracking insight action:', error);
  }
}
