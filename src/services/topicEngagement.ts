// Topic Engagement Service
// Handles: likes, saves, shares, hiding topics

import { supabase } from './supabase';
import { analytics } from './analytics';

export interface SavedTopic {
  id: string;
  userId: string;
  topicId: string;
  topicTitle: string | null;
  topicMessage: string | null;
  articleContent: string | null;
  topicCategory: string | null;
  sourceUrl: string | null;
  savedAt: string;
  opened: boolean;
}

export interface TopicReaction {
  id: string;
  userId: string;
  topicId: string;
  reactionType: 'like' | 'love' | 'insightful' | 'inspiring';
  topicCategory: string | null;
  createdAt: string;
}

/**
 * Like/react to a topic
 */
export const reactToTopic = async (
  userId: string,
  topicId: string,
  reactionType: 'like' | 'love' | 'insightful' | 'inspiring' = 'like',
  topicCategory?: string
): Promise<TopicReaction | null> => {
  try {
    // Upsert reaction
    const { data, error } = await supabase
      .from('topic_reactions')
      .upsert({
        user_id: userId,
        topic_id: topicId,
        reaction_type: reactionType,
        topic_category: topicCategory,
      }, {
        onConflict: 'user_id,topic_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error reacting to topic:', error);
      return null;
    }

    // Track analytics
    analytics.trackTopicLiked(userId, topicId, topicCategory);

    return {
      id: data.id,
      userId: data.user_id,
      topicId: data.topic_id,
      reactionType: data.reaction_type,
      topicCategory: data.topic_category,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Exception reacting to topic:', error);
    return null;
  }
};

/**
 * Remove reaction from topic
 */
export const unreactToTopic = async (userId: string, topicId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('topic_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('topic_id', topicId);

    return !error;
  } catch (error) {
    console.error('Exception unreacting to topic:', error);
    return false;
  }
};

/**
 * Check if user has reacted to topic
 */
export const getUserTopicReaction = async (
  userId: string,
  topicId: string
): Promise<TopicReaction | null> => {
  try {
    const { data, error } = await supabase
      .from('topic_reactions')
      .select('*')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      topicId: data.topic_id,
      reactionType: data.reaction_type,
      topicCategory: data.topic_category,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Exception getting user topic reaction:', error);
    return null;
  }
};

/**
 * Save topic for later
 */
export const saveTopic = async (
  userId: string,
  topicId: string,
  topicTitle: string,
  topicMessage: string,
  articleContent: string,
  topicCategory?: string,
  sourceUrl?: string
): Promise<SavedTopic | null> => {
  try {
    const { data, error} = await supabase
      .from('saved_topics')
      .upsert({
        user_id: userId,
        topic_id: topicId,
        topic_title: topicTitle,
        topic_message: topicMessage,
        article_content: articleContent,
        topic_category: topicCategory,
        source_url: sourceUrl,
      }, {
        onConflict: 'user_id,topic_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving topic:', error);
      return null;
    }

    // Track analytics
    analytics.trackTopicSaved(userId, topicId, topicCategory);

    return {
      id: data.id,
      userId: data.user_id,
      topicId: data.topic_id,
      topicTitle: data.topic_title,
      topicMessage: data.topic_message,
      articleContent: data.article_content,
      topicCategory: data.topic_category,
      sourceUrl: data.source_url,
      savedAt: data.saved_at,
      opened: data.opened,
    };
  } catch (error) {
    console.error('Exception saving topic:', error);
    return null;
  }
};

/**
 * Unsave topic
 */
export const unsaveTopic = async (userId: string, topicId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('saved_topics')
      .delete()
      .eq('user_id', userId)
      .eq('topic_id', topicId);

    return !error;
  } catch (error) {
    console.error('Exception unsaving topic:', error);
    return false;
  }
};

/**
 * Get all saved topics for user
 */
export const getSavedTopics = async (userId: string): Promise<SavedTopic[]> => {
  try {
    const { data, error } = await supabase
      .from('saved_topics')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (error || !data) return [];

    const mapped: SavedTopic[] = data.map(item => ({
      id: item.id,
      userId: item.user_id,
      topicId: item.topic_id,
      topicTitle: item.topic_title,
      topicMessage: item.topic_message ?? null,
      articleContent: item.article_content ?? null,
      topicCategory: item.topic_category,
      sourceUrl: item.source_url,
      savedAt: item.saved_at,
      opened: item.opened,
    }));

    // Hydrate missing content from feed_topics when possible
    const missing = mapped.filter(t => !t.topicMessage || !t.articleContent);
    if (missing.length > 0) {
      const ids = missing.map(t => t.topicId);
      const { data: feedRows, error: feedErr } = await supabase
        .from('feed_topics')
        .select('id, topic, message, source_title, source_description, source_url, category')
        .in('id', ids);

      if (!feedErr && feedRows && feedRows.length) {
        const byId = new Map<string, any>(feedRows.map(r => [r.id, r]));
        for (const t of mapped) {
          const src = byId.get(t.topicId);
          if (src) {
            if (!t.topicTitle && (src.source_title || src.topic)) t.topicTitle = src.source_title || src.topic;
            if (!t.topicMessage && src.message) t.topicMessage = src.message;
            if (!t.articleContent && src.source_description) t.articleContent = src.source_description;
            if (!t.sourceUrl && src.source_url) t.sourceUrl = src.source_url;
            if (!t.topicCategory && src.category) t.topicCategory = src.category;
          }
        }

        // Persist back any hydrated fields to saved_topics
        const updates = mapped.filter(t => ids.includes(t.topicId));
        for (const u of updates) {
          await supabase
            .from('saved_topics')
            .update({
              topic_title: u.topicTitle,
              topic_message: u.topicMessage,
              article_content: u.articleContent,
              topic_category: u.topicCategory,
              source_url: u.sourceUrl,
            })
            .eq('user_id', userId)
            .eq('topic_id', u.topicId);
        }
      }
    }

    return mapped;
  } catch (error) {
    console.error('Exception getting saved topics:', error);
    return [];
  }
};

/**
 * Check if topic is saved
 */
export const isTopicSaved = async (userId: string, topicId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('saved_topics')
      .select('id')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .maybeSingle();

    return !error && data !== null;
  } catch (error) {
    console.error('Exception checking if topic saved:', error);
    return false;
  }
};

/**
 * Mark saved topic as opened
 */
export const markSavedTopicOpened = async (userId: string, topicId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('saved_topics')
      .update({ opened: true })
      .eq('user_id', userId)
      .eq('topic_id', topicId);

    return !error;
  } catch (error) {
    console.error('Exception marking saved topic as opened:', error);
    return false;
  }
};

/**
 * Hide a specific topic
 */
export const hideTopic = async (
  userId: string,
  topicId: string,
  category?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('hidden_topics')
      .insert({
        user_id: userId,
        topic_id: topicId,
        category,
        hide_type: 'topic',
      });

    if (!error) {
      analytics.trackTopicHidden(userId, topicId, 'manual_hide');
    }

    return !error;
  } catch (error) {
    console.error('Exception hiding topic:', error);
    return false;
  }
};

/**
 * Hide entire category
 */
export const hideCategory = async (userId: string, category: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('hidden_topics')
      .insert({
        user_id: userId,
        category,
        hide_type: 'category',
      });

    if (!error) {
      analytics.trackTopicHidden(userId, `category:${category}`, 'hide_category');
    }

    return !error;
  } catch (error) {
    console.error('Exception hiding category:', error);
    return false;
  }
};

/**
 * Get all hidden topics and categories for user
 */
export const getHiddenItems = async (
  userId: string
): Promise<{ topics: string[]; categories: string[] }> => {
  try {
    const { data, error } = await supabase
      .from('hidden_topics')
      .select('topic_id, category, hide_type')
      .eq('user_id', userId);

    if (error || !data) return { topics: [], categories: [] };

    const topics = data
      .filter(item => item.hide_type === 'topic' && item.topic_id)
      .map(item => item.topic_id as string);

    const categories = data
      .filter(item => item.hide_type === 'category' && item.category)
      .map(item => item.category as string);

    return { topics, categories };
  } catch (error) {
    console.error('Exception getting hidden items:', error);
    return { topics: [], categories: [] };
  }
};

/**
 * Get user's topic preferences based on reactions
 */
export const getUserTopicPreferences = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('topic_reactions')
      .select('topic_category')
      .eq('user_id', userId);

    if (error || !data) return { likedCategories: [], reactionCount: 0 };

    // Count reactions by category
    const categoryCounts: Record<string, number> = {};
    data.forEach(reaction => {
      if (reaction.topic_category) {
        categoryCounts[reaction.topic_category] = 
          (categoryCounts[reaction.topic_category] || 0) + 1;
      }
    });

    // Sort by count
    const likedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);

    return {
      likedCategories,
      reactionCount: data.length,
    };
  } catch (error) {
    console.error('Exception getting user topic preferences:', error);
    return { likedCategories: [], reactionCount: 0 };
  }
};
