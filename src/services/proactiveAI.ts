import { supabase } from './supabase';
import { generateProactiveConversationStarters } from './ai';
import { scheduleNextDayNotifications } from './notifications';

export const generateAndScheduleProactiveConversations = async (userId: string) => {
  try {
    // Get user interests
    const { data: interests } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', userId);

    const userInterests = interests?.map((i: any) => i.interest) || [];
    const currentDate = new Date().toLocaleDateString();

    // Generate conversation starters
    const conversationStarters = await generateProactiveConversationStarters(userInterests, currentDate);

    // Calculate schedule times for today
    const now = new Date();
    const times = [
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0), // 9 AM
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0), // 2 PM
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0), // 7 PM
    ];

    // Save to database
    const proactiveTopics = conversationStarters.slice(0, 3).map((starter, index) => ({
      user_id: userId,
      topic: `Daily Conversation ${index + 1}`,
      message: starter,
      interests: userInterests,
      scheduled_for: times[index].toISOString(),
      is_sent: times[index] <= now, // Mark as sent if time has passed
    }));

    const { error } = await supabase
      .from('proactive_topics')
      .insert(proactiveTopics);

    if (error) {
      console.error('Error saving proactive topics:', error);
      return false;
    }

    // Schedule notifications for future times
    const futureStarters = conversationStarters.filter((_, index) => times[index] > now);
    if (futureStarters.length > 0) {
      await scheduleNextDayNotifications(futureStarters);
    }

    return true;
  } catch (error) {
    console.error('Error generating proactive conversations:', error);
    return false;
  }
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
      .gte('scheduled_for', startOfDay.toISOString())
      .lte('scheduled_for', endOfDay.toISOString())
      .order('scheduled_for', { ascending: true });

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

export const markProactiveTopicAsSent = async (topicId: string) => {
  try {
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
