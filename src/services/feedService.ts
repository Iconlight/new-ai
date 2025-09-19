import { supabase } from './supabase';
import { newsService, TrendingTopic, NewsArticle } from './newsService';
import { ProactiveTopic } from '../types';
import { testFeedTables } from './testFeedTables';

export type FeedType = 'interests' | 'foryou';

// Ensure we operate as the authenticated user to satisfy RLS
async function resolveAuthedUserId(requestedUserId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('Not authenticated');
  return auth.user.id !== requestedUserId ? auth.user.id : requestedUserId;
}

// Create a new batch record and return its id
async function createBatch(userId: string, feedType: FeedType, metadata: any = {}): Promise<string> {
  console.log('📦 Creating batch for user:', userId, 'feedType:', feedType);
  const { data, error } = await supabase
    .from('feed_batches')
    .insert([{ user_id: userId, feed_type: feedType, metadata }])
    .select('id')
    .single();
  if (error) {
    console.error('❌ Error creating batch:', error);
    throw error;
  }
  console.log('✅ Created batch with id:', data.id);
  return data.id as string;
}

// Insert topics for a batch
async function insertBatchTopics(
  userId: string,
  feedType: FeedType,
  batchId: string,
  items: Array<{
    topic: string;
    message: string;
    interests?: string[];
    category?: string;
    source_type?: 'news' | 'evergreen' | 'location' | 'serendipity';
    source_url?: string;
    source_title?: string;
  }>
): Promise<void> {
  if (!items.length) {
    console.log('⚠️ No items to insert for batch:', batchId);
    return;
  }
  console.log('📝 Inserting', items.length, 'topics for batch:', batchId);
  const payload = items.map((it) => ({
    batch_id: batchId,
    user_id: userId,
    feed_type: feedType,
    topic: it.topic,
    message: it.message,
    interests: it.interests ?? (it.category ? [it.category] : []),
    category: it.category ?? null,
    source_type: it.source_type ?? null,
    source_url: it.source_url ?? null,
    source_title: it.source_title ?? null,
  }));
  const { error } = await supabase.from('feed_topics').insert(payload);
  if (error) {
    console.error('❌ Error inserting topics:', error);
    throw error;
  }
  console.log('✅ Successfully inserted', items.length, 'topics');
}

// Public: refresh the Interests feed with real-time internet data and persist as a new batch
export async function refreshInterestsFeed(userId: string): Promise<void> {
  console.log('🔄 refreshInterestsFeed starting for user:', userId);
  
  // Test if tables exist first
  await testFeedTables();
  
  const uid = await resolveAuthedUserId(userId);
  console.log('✅ Resolved authenticated user:', uid);

  // Load user interests
  const { data: interestsRows, error: interestsError } = await supabase
    .from('user_interests')
    .select('interest')
    .eq('user_id', uid);
  if (interestsError) {
    console.error('❌ Error loading user interests:', interestsError);
    throw interestsError;
  }

  const interests = (interestsRows || []).map((r: any) => r.interest).filter(Boolean) as string[];
  console.log('📋 User interests found:', interests);

  // Clear cache to ensure fresh articles on each refresh
  await newsService.clearCache();
  
  // Fetch current news with broader categories to get more articles
  console.log('📰 Fetching current news...');
  const allCategories = ['general', 'technology', 'science', 'business', 'health', 'entertainment', 'sports', 'environment'];
  const allArticles: NewsArticle[] = await newsService.fetchCurrentNews(allCategories);
  console.log('📰 Total articles fetched:', allArticles.length);
  
  // Don't limit articles here - let all categories be represented
  const articles = allArticles; // Use all articles for better category distribution

  let selected: NewsArticle[] = [];
  
  if (interests.length > 0) {
    console.log('🎯 Matching articles to interests:', interests);
    
    // Group articles by category first
    const categoryGroups = new Map<string, NewsArticle[]>();
    articles.forEach(article => {
      const cat = article.category || 'general';
      if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
      categoryGroups.get(cat)!.push(article);
    });
    
    console.log('📊 Articles by category:', 
      Array.from(categoryGroups.entries()).map(([cat, arts]) => `${cat}: ${arts.length}`).join(', ')
    );
    
    // Map user interests to article categories
    const interestToCategoryMap: Record<string, string[]> = {
      'technology': ['technology'],
      'science': ['science'],
      'movies & tv': ['entertainment'],
      'entertainment': ['entertainment'],
      'business': ['business'],
      'health': ['health']
    };
    
    // Get articles from relevant categories, distributed evenly
    const selectedByCategory: NewsArticle[] = [];
    const articlesPerInterest = Math.ceil(24 / interests.length); // Increased from 12 to 24
    
    interests.forEach(interest => {
      const relevantCategories = interestToCategoryMap[interest.toLowerCase()] || [interest.toLowerCase()];
      console.log(`🔍 Interest "${interest}" -> categories:`, relevantCategories);
      
      relevantCategories.forEach(category => {
        const categoryArticles = categoryGroups.get(category) || [];
        const toAdd = categoryArticles.slice(0, articlesPerInterest);
        selectedByCategory.push(...toAdd);
        console.log(`📰 Added ${toAdd.length} articles from ${category} for ${interest}`);
      });
    });
    
    // Remove duplicates and limit to 12
    const uniqueSelected = selectedByCategory.filter((article, index, self) => 
      index === self.findIndex(a => a.id === article.id)
    );
    
    selected = uniqueSelected.slice(0, 24); // Increased from 12 to 24
    
    console.log('✅ Final selection by category:', 
      selected.reduce((acc, article) => {
        const cat = article.category || 'general';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    );
  } else {
    // No interests set, use top articles
    console.log('⚠️ No user interests found, using top articles');
    selected = articles.slice(0, 24); // Increased from 12 to 24
  }

  console.log('✅ Selected articles for interests feed:', selected.length);

  const batchId = await createBatch(uid, 'interests', { interests, count: selected.length });
  console.log('✅ Created batch:', batchId);

  // Map into conversation-starter items
  const items = selected.map((a) => ({
    topic: `Focused: ${a.category || 'topic'}`,
    message: `"${a.title}" — ${a.description || ''} What resonates with your interests here?`,
    interests: interests.length > 0 ? interests : [a.category || 'general'],
    category: a.category,
    source_type: 'news' as const,
    source_url: a.url,
    source_title: a.title,
  }));

  await insertBatchTopics(uid, 'interests', batchId, items);
  console.log('✅ Inserted', items.length, 'topics for interests feed');
}

// Public: refresh the For You feed with mixed random categories and trending news
export async function refreshForYouFeed(userId: string): Promise<void> {
  console.log('🔄 refreshForYouFeed starting for user:', userId);
  
  // Test if tables exist first
  await testFeedTables();
  
  const uid = await resolveAuthedUserId(userId);
  console.log('✅ Resolved authenticated user:', uid);

  // Clear cache to ensure fresh articles on each refresh
  await newsService.clearCache();
  
  // Fetch fresh news from all categories for diverse For You content
  console.log('📰 Fetching fresh news for For You feed...');
  const allCategories = ['general', 'technology', 'science', 'business', 'health', 'entertainment', 'sports', 'environment'];
  const articles = await newsService.fetchCurrentNews(allCategories);
  console.log('📰 Fresh articles fetched for For You:', articles.length);

  // Shuffle articles to create variety and randomness like TikTok
  const shuffledArticles = articles.sort(() => Math.random() - 0.5);
  
  // Take diverse selection from different categories
  const categoryGroups = new Map<string, NewsArticle[]>();
  shuffledArticles.forEach(article => {
    const cat = article.category || 'general';
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(article);
  });

  const batchId = await createBatch(uid, 'foryou', { count: 24 }); // Increased from 12 to 24
  console.log('✅ Created batch:', batchId);
  
  const items: Array<{ topic: string; message: string; interests?: string[]; category?: string; source_type?: any; source_url?: string; source_title?: string; }> = [];

  // Create conversation starters from real news articles (ALL from internet sources)
  const selectedArticles = shuffledArticles.slice(0, 24); // Increased from 12 to 24
  selectedArticles.forEach((article) => {
    const categoryEmoji = {
      'technology': '💻',
      'science': '🔬', 
      'entertainment': '🎬',
      'business': '💼',
      'health': '🏥',
      'sports': '⚽',
      'environment': '🌍',
      'general': '📰'
    }[article.category || 'general'] || '📰';

    items.push({
      topic: `${categoryEmoji} ${article.category || 'News'}`,
      message: `"${article.title}" — ${article.description || ''} What's your take on this?`,
      interests: [article.category || 'general'],
      category: article.category,
      source_type: 'news',
      source_url: article.url,
      source_title: article.title,
    });
  });

  console.log('✅ Total items for For You feed:', items.length);
  console.log('📊 All items are from real internet sources');
  console.log('📂 Categories included:', [...new Set(items.map(i => i.category))].join(', '));

  await insertBatchTopics(uid, 'foryou', batchId, items);
  console.log('✅ Inserted', items.length, 'topics for For You feed');
}

// Public: get topics from the latest batch for a feed type
export async function getActiveFeedTopics(userId: string, feedType: FeedType): Promise<ProactiveTopic[]> {
  console.log('🔍 getActiveFeedTopics for user:', userId, 'feedType:', feedType);
  const uid = await resolveAuthedUserId(userId);

  // Latest batch
  const { data: batch, error: batchError } = await supabase
    .from('feed_batches')
    .select('id, created_at')
    .eq('user_id', uid)
    .eq('feed_type', feedType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (batchError) {
    console.error('❌ Error fetching batch:', batchError);
    if (batchError.code === 'PGRST116') {
      console.log('ℹ️ No batch found for', feedType, 'feed - this is normal on first load');
    }
    return [];
  }

  if (!batch) {
    console.log('ℹ️ No batch found for', feedType, 'feed');
    return [];
  }

  console.log('✅ Found batch:', batch.id, 'created at:', batch.created_at);

  // Topics in batch
  const { data: topics, error: topicsError } = await supabase
    .from('feed_topics')
    .select('*')
    .eq('batch_id', batch.id)
    .order('created_at', { ascending: false });

  if (topicsError) {
    console.error('❌ Error fetching topics:', topicsError);
    return [];
  }

  if (!topics || topics.length === 0) {
    console.log('⚠️ No topics found in batch:', batch.id);
    return [];
  }

  console.log('✅ Found', topics.length, 'topics in batch');

  // Map to UI shape and tag as feed-sourced, with prefixed id so UI won't treat it as proactive_topics UUID
  return topics.map((t: any) => ({
    id: `feed-${t.id}`,
    user_id: t.user_id,
    topic: t.topic,
    message: t.message,
    interests: t.interests || (t.category ? [t.category] : []),
    is_sent: false,
    scheduled_for: t.created_at,
    sent_at: undefined,
    created_at: t.created_at,
    // extended hints for callers
    source: 'feed_topics',
    source_id: t.id,
  } as ProactiveTopic & { source: 'feed_topics'; source_id: string }));
}

export async function markFeedTopicConsumed(topicId: string): Promise<void> {
  // topicId should be UUID from feed_topics; callers pass raw (not prefixed)
  const { error } = await supabase
    .from('feed_topics')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', topicId);
  if (error) console.error('Error marking feed topic consumed:', error);
}
