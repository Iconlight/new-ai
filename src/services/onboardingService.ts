// Onboarding Service
// Handles smart onboarding flow with immediate first topic

import { supabase } from './supabase';
import { generateTopicStarter } from './proactiveAI';

export interface OnboardingTopic {
  topic: string;
  message: string;
  category: string;
  emoji: string;
}

// Curated first topics that work for everyone
const FIRST_TOPICS: OnboardingTopic[] = [
  {
    topic: "🤔 Decision Making",
    message: "Do you trust your gut feelings when making important decisions, or do you prefer to analyze all the data first? I'm curious about your process.",
    category: "psychology",
    emoji: "🤔",
  },
  {
    topic: "🚀 Future of Work",
    message: "With AI getting better every day, what skills do you think will be most valuable in 10 years? Are there things only humans will always do better?",
    category: "technology",
    emoji: "🚀",
  },
  {
    topic: "🎨 Creativity",
    message: "When do you feel most creative? Is it when you're alone, collaborating with others, or maybe in the shower? What sparks your best ideas?",
    category: "general",
    emoji: "🎨",
  },
  {
    topic: "🌍 Travel Philosophy",
    message: "Would you rather visit the same place many times to really know it, or see as many new places as possible? What's your travel style?",
    category: "lifestyle",
    emoji: "🌍",
  },
  {
    topic: "📚 Learning Style",
    message: "How do you learn best? Reading, watching videos, hands-on practice, or discussing with others? I find it fascinating how different people absorb information.",
    category: "education",
    emoji: "📚",
  },
];

/**
 * Get a random first topic for new users
 */
export function getFirstTopic(): OnboardingTopic {
  return FIRST_TOPICS[Math.floor(Math.random() * FIRST_TOPICS.length)];
}

/**
 * Create immediate first chat for new user
 */
export async function createFirstConversation(userId: string): Promise<string | null> {
  try {
    const firstTopic = getFirstTopic();
    
    // Create the chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        title: firstTopic.topic,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (chatError || !chat) {
      console.error('Error creating first chat:', chatError);
      return null;
    }

    // Add the first message (the topic starter)
    await supabase
      .from('messages')
      .insert({
        chat_id: chat.id,
        content: firstTopic.message,
        role: 'assistant',
        created_at: new Date().toISOString(),
      });

    return chat.id;
  } catch (error) {
    console.error('Error in createFirstConversation:', error);
    return null;
  }
}

/**
 * Track onboarding progress
 */
export async function trackOnboardingStep(
  userId: string,
  step: 'signup' | 'first_topic_seen' | 'first_message_sent' | 'interests_selected' | 'networking_intro_seen' | 'completed'
): Promise<void> {
  try {
    await supabase
      .from('user_onboarding_progress')
      .upsert({
        user_id: userId,
        [step]: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
  } catch (error) {
    console.error('Error tracking onboarding step:', error);
  }
}

/**
 * Get onboarding progress for user
 */
export async function getOnboardingProgress(userId: string): Promise<{
  first_topic_seen: boolean;
  first_message_sent: boolean;
  interests_selected: boolean;
  networking_intro_seen: boolean;
  completed: boolean;
} | null> {
  try {
    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error getting onboarding progress:', error);
      return null;
    }

    return data || {
      first_topic_seen: false,
      first_message_sent: false,
      interests_selected: false,
      networking_intro_seen: false,
      completed: false,
    };
  } catch (error) {
    console.error('Error in getOnboardingProgress:', error);
    return null;
  }
}

/**
 * Check if user should see networking intro
 */
export async function shouldShowNetworkingIntro(userId: string): Promise<boolean> {
  try {
    const progress = await getOnboardingProgress(userId);
    if (!progress) return true;

    // Show networking intro after user has:
    // 1. Sent their first message
    // 2. Selected interests
    // 3. Haven't seen networking intro yet
    return progress.first_message_sent && 
           progress.interests_selected && 
           !progress.networking_intro_seen;
  } catch (error) {
    console.error('Error checking networking intro status:', error);
    return false;
  }
}

/**
 * Check if user needs interest selection
 */
export async function shouldShowInterestSelection(userId: string): Promise<boolean> {
  try {
    const progress = await getOnboardingProgress(userId);
    if (!progress) return true;

    // Show interests after first message
    return progress.first_message_sent && !progress.interests_selected;
  } catch (error) {
    console.error('Error checking interest selection status:', error);
    return true;
  }
}
