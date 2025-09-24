import { supabase } from './supabase';
import { generateProactiveConversationStarters } from './ai';
import { ProactiveTopic } from '../types';
import { newsService, NewsArticle, TrendingTopic } from './newsService';
import { locationService, LocationContext, LocationBasedTopic } from './locationService';

// Utility: validate UUID to avoid sending non-DB ids (like 'news-...') to Supabase
const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
// DEPRECATED: Scheduling functionality removed - now using batched feeds instead
export const generateAndScheduleProactiveConversations = async (userId: string) => {
  console.log('⚠️ generateAndScheduleProactiveConversations is deprecated - use feedService instead');
  return [];
};

export const getTodaysProactiveTopics = async (userId: string) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const { data, error } = await supabase
      .from('proactive_topics')
      .select('*')
      .eq('user_id', userId)
      .eq('is_sent', false)
      .gte('scheduled_for', startOfDay.toISOString())
      .lte('scheduled_for', endOfDay.toISOString())
      // Show newest first
      .order('created_at', { ascending: false })
      .order('scheduled_for', { ascending: false });

    if (error) {
      console.error('Error fetching proactive topics:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching proactive topics:', error);
    return [];
  }
};

// Remove today's proactive topics before regenerating (by default preserves already sent ones)
export const resetTodaysProactiveTopics = async (
  userId: string,
  preserveSent: boolean = true
): Promise<boolean> => {
  try {
    // Ensure we have an authenticated user; RLS requires it
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      throw new Error('Not authenticated');
    }
    const authedUserId = auth.user.id;
    if (authedUserId !== userId) {
      userId = authedUserId;
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    let query = supabase
      .from('proactive_topics')
      .delete()
      .eq('user_id', userId)
      .gte('scheduled_for', startOfDay.toISOString())
      .lte('scheduled_for', endOfDay.toISOString());

    if (preserveSent) {
      query = query.eq('is_sent', false);
    }

    const { error } = await query;
    if (error) {
      console.error('Error resetting today\'s proactive topics:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error resetting today\'s proactive topics:', error);
    return false;
  }
};

export const markProactiveTopicAsSent = async (topicId: string) => {
  try {
    // Only mark topics that exist in DB (UUID ids). Skip synthetic ids like 'news-...'
    if (!isUuid(String(topicId))) {
      return;
    }
    const { error } = await supabase
      .from('proactive_topics')
      .update({ 
        is_sent: true, 
        sent_at: new Date().toISOString() 
      })
      .eq('id', topicId);

    if (error) {
      console.error('Error marking topic as sent:', error);
    }
  } catch (error) {
    console.error('Error marking topic as sent:', error);
  }
};

// Enhanced conversation starter generation with news and location context
const generateContextualConversationStarters = async (
  userInterests: string[],
  currentDate: string,
  locationTopics: LocationBasedTopic | null,
  trendingTopics: TrendingTopic[]
): Promise<string[]> => {
  try {
    // Build context for AI generation
    let contextPrompt = `Generate 3 engaging conversation starters for ${currentDate}. User interests: ${userInterests.join(', ')}.`;
    
    // Add location context
    if (locationTopics) {
      contextPrompt += ` User is currently at ${locationTopics.location.type}. Relevant topics: ${locationTopics.topics.slice(0, 3).join(', ')}.`;
    }
    
    // Add news context
    if (trendingTopics.length > 0) {
      const topNews = trendingTopics.slice(0, 2);
      contextPrompt += ` Current trending topics: ${topNews.map(t => `${t.topic} (${t.articles[0]?.title})`).join(', ')}.`;
    }
    
    contextPrompt += ` Make the conversations proactive, thought-provoking, and personalized. Each should be a complete conversation starter, not just a topic.`;

    // Use existing AI service with enhanced context
    const starters = await generateProactiveConversationStarters([contextPrompt], currentDate);
    
    // Fallback to location-based starters if AI fails
    if (!starters || starters.length === 0) {
      return generateFallbackStarters(userInterests, locationTopics, trendingTopics);
    }
    
    return starters;
  } catch (error) {
    console.error('Error generating contextual conversation starters:', error);
    return generateFallbackStarters(userInterests, locationTopics, trendingTopics);
  }
};

// Fallback conversation starters when AI service is unavailable
// Add light randomization and informal closers to avoid repetition
const generateFallbackStarters = (
  userInterests: string[],
  locationTopics: LocationBasedTopic | null,
  trendingTopics: TrendingTopic[]
): string[] => {
  const starters: string[] = [];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const casualClosers = [
    'wild, right?',
    'big if true.',
    'what’s the tea?',
    'hot or not?',
    'W or L?',
    'where do you land on this?',
    'curious what jumps out to you.',
  ];
  
  // Location-based starter
  if (locationTopics && locationTopics.conversationStarters.length > 0) {
    starters.push(locationTopics.conversationStarters[0]);
  }
  
  // News-based starter
  if (trendingTopics.length > 0) {
    const topTrend = trendingTopics[0];
    const closer = pick(casualClosers);
    starters.push(`Low-key big news: "${topTrend.articles[0]?.title}" (${topTrend.topic}). ${closer}`);
  }
  
  // Interest-based starter
  if (userInterests.length > 0) {
    const randomInterest = userInterests[Math.floor(Math.random() * userInterests.length)];
    const closer = pick([
      `from a ${randomInterest.toLowerCase()} angle, what stands out?`,
      'spicy take?',
      'what’s the underrated angle here?',
      'what would you challenge about the mainstream view?',
    ]);
    starters.push(`Been chewing on ${randomInterest} lately — so much going on. ${closer}`);
  }
  
  // Default starters if nothing else works
  const defaultStarters = [
    "What's something you've learned recently that changed your perspective?",
    "If you could have a conversation with anyone from history, who would it be and what would you ask?",
    "What's a skill you've always wanted to develop but haven't had the chance to pursue?"
  ];
  
  // Fill remaining slots with defaults
  while (starters.length < 3) {
    const remaining = defaultStarters.filter(s => !starters.includes(s));
    if (remaining.length === 0) break;
    starters.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }
  
  return starters.slice(0, 3);
};

// Clear cached data to force fresh content generation
export const clearProactiveCache = async (): Promise<void> => {
  try {
    // Clear news cache
    await newsService.clearCache();
    
    // Clear location cache if needed
    await locationService.clearCache();
    
    console.log('Proactive AI cache cleared successfully');
  } catch (error) {
    console.error('Error clearing proactive cache:', error);
  }
};

// Get "For You" topics that include news and contextual content
export const getForYouTopics = async (userId: string): Promise<ProactiveTopic[]> => {
  try {
    // Get user interests
    const { data: interests } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', userId);

    const userInterests = interests?.map((i: any) => i.interest) || [];
    
    // Get location context
    const locationContext = await locationService.getCurrentLocation();
    
    // Get GENERAL trending news (not filtered by user interests)
    let generalTrendingTopics = await newsService.getGeneralTrendingTopics();
    
    // Fallback: if no general trends were found (e.g., network/API issues),
    // derive trends from freshly fetched articles to guarantee variety.
    if (!generalTrendingTopics || generalTrendingTopics.length === 0) {
      const articles = await newsService.fetchCurrentNews();
      const topicMap = new Map<string, { articles: NewsArticle[], relevance: number }>();
      articles.forEach(article => {
        const topic = article.category || 'general';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { articles: [], relevance: 0.5 });
        }
        const entry = topicMap.get(topic)!;
        entry.articles.push(article);
        entry.relevance = Math.max(entry.relevance, 0.5);
      });
      generalTrendingTopics = Array.from(topicMap.entries()).map(([topic, data]) => ({
        topic,
        category: topic,
        relevance: data.relevance,
        articles: data.articles.slice(0, 3),
      })).sort((a, b) => b.relevance - a.relevance);
    }
    
    // Generate contextual topics with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const topics: ProactiveTopic[] = [];
    
    // Add broader news-based topics (3-4 topics from general trends)
    generalTrendingTopics.slice(0, 4).forEach((trend, index) => {
      if (trend.articles.length > 0) {
        const article = trend.articles[0];
        const conversationStarters = [
          `Here's something trending: "${article.title}". ${article.description} What's your take on this?`,
          `I came across this interesting development: "${article.title}". How do you think this might impact things?`,
          `This caught my attention: "${article.title}". What aspects of this story intrigue you most?`,
          `Breaking: "${article.title}". What questions does this raise for you?`
        ];
        
        topics.push({
          id: `news-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          topic: `Trending: ${trend.topic}`,
          message: conversationStarters[index % conversationStarters.length],
          interests: [trend.topic], // Use the news category as interest
          scheduled_for: new Date().toISOString(),
          is_sent: false,
          created_at: new Date().toISOString(),
        });
      }
    });
    
    // Add location-based topics (1-2 topics)
    if (locationContext) {
      const locationTopics = locationService.getLocationBasedTopics(locationContext, userInterests);
      locationTopics.conversationStarters.slice(0, 2).forEach((starter, index) => {
        topics.push({
          id: `location-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          topic: `${locationContext.type.charAt(0).toUpperCase() + locationContext.type.slice(1)} Conversation`,
          message: starter,
          interests: locationTopics.topics.slice(0, 3),
          scheduled_for: new Date().toISOString(),
          is_sent: false,
          created_at: new Date().toISOString(),
        });
      });
    }
    
    // Add some serendipitous topics that mix interests with current events
    if (userInterests.length > 0 && generalTrendingTopics.length > 0) {
      const randomInterest = userInterests[Math.floor(Math.random() * userInterests.length)];
      const randomTrend = generalTrendingTopics[Math.floor(Math.random() * Math.min(3, generalTrendingTopics.length))];
      
      topics.push({
        id: `serendipity-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        topic: `${randomInterest} meets ${randomTrend.topic}`,
        message: `I was thinking about how ${randomInterest} might relate to what's happening with ${randomTrend.topic}. Do you see any interesting connections?`,
        interests: [randomInterest, randomTrend.topic],
        scheduled_for: new Date().toISOString(),
        is_sent: false,
        created_at: new Date().toISOString(),
      });
    }
    
    // Shuffle topics to add variety
    return topics.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Error generating For You topics:', error);
    return [];
  }
};
