// Analytics service for tracking user behavior and app performance
// Uses Supabase for storage - can be migrated to dedicated analytics later

import { supabase } from './supabase';

export type AnalyticsEvent = 
  | 'topic_viewed'
  | 'topic_opened'
  | 'topic_liked'
  | 'topic_saved'
  | 'topic_shared'
  | 'topic_hidden'
  | 'conversation_started'
  | 'conversation_abandoned'
  | 'conversation_completed'
  | 'message_sent'
  | 'match_viewed'
  | 'match_accepted'
  | 'match_declined'
  | 'match_conversation_started'
  | 'match_conversation_rated'
  | 'app_opened'
  | 'screen_viewed'
  | 'error_occurred'
  | 'performance_metric';

interface AnalyticsEventData {
  event: AnalyticsEvent;
  userId?: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

class AnalyticsService {
  private eventQueue: AnalyticsEventData[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_QUEUE_SIZE = 50;

  constructor() {
    this.startFlushInterval();
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent, userId?: string, properties?: Record<string, any>) {
    const sanitizedUserId = typeof userId === 'string' && userId.trim() === '' ? undefined : userId;
    const eventData: AnalyticsEventData = {
      event,
      userId: sanitizedUserId,
      properties,
      timestamp: new Date().toISOString(),
    };

    this.eventQueue.push(eventData);

    // Flush immediately if queue is full
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  /**
   * Track topic engagement
   */
  trackTopicViewed(userId: string, topicId: string, category?: string) {
    this.track('topic_viewed', userId, { topicId, category });
  }

  trackTopicOpened(userId: string, topicId: string, category?: string, source?: string) {
    this.track('topic_opened', userId, { topicId, category, source });
  }

  trackTopicLiked(userId: string, topicId: string, category?: string) {
    this.track('topic_liked', userId, { topicId, category });
  }

  trackTopicSaved(userId: string, topicId: string, category?: string) {
    this.track('topic_saved', userId, { topicId, category });
  }

  trackTopicShared(userId: string, topicId: string, platform?: string) {
    this.track('topic_shared', userId, { topicId, platform });
  }

  trackTopicHidden(userId: string, topicId: string, reason?: string) {
    this.track('topic_hidden', userId, { topicId, reason });
  }

  /**
   * Track conversation engagement
   */
  trackConversationStarted(userId: string, topicId: string, chatId: string) {
    this.track('conversation_started', userId, { topicId, chatId });
  }

  trackConversationAbandoned(userId: string, chatId: string, messageCount: number, duration: number) {
    this.track('conversation_abandoned', userId, { chatId, messageCount, duration });
  }

  trackConversationCompleted(userId: string, chatId: string, messageCount: number, duration: number) {
    this.track('conversation_completed', userId, { chatId, messageCount, duration });
  }

  trackMessageSent(userId: string, chatId: string, messageLength: number) {
    this.track('message_sent', userId, { chatId, messageLength });
  }

  /**
   * Track networking engagement
   */
  trackMatchViewed(userId: string, matchId: string, compatibilityScore: number) {
    this.track('match_viewed', userId, { matchId, compatibilityScore });
  }

  trackMatchAccepted(userId: string, matchId: string, compatibilityScore: number) {
    this.track('match_accepted', userId, { matchId, compatibilityScore });
  }

  trackMatchDeclined(userId: string, matchId: string, compatibilityScore: number, reason?: string) {
    this.track('match_declined', userId, { matchId, compatibilityScore, reason });
  }

  trackMatchConversationRated(userId: string, matchId: string, rating: number, feedback?: string) {
    this.track('match_conversation_rated', userId, { matchId, rating, feedback });
  }

  /**
   * Track app usage
   */
  trackAppOpened(userId?: string) {
    this.track('app_opened', userId);
  }

  trackScreenViewed(userId: string | undefined, screenName: string) {
    this.track('screen_viewed', userId, { screenName });
  }

  /**
   * Track errors
   */
  trackError(userId: string | undefined, error: Error, context?: string) {
    this.track('error_occurred', userId, {
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(userId: string | undefined, metric: string, value: number, context?: Record<string, any>) {
    this.track('performance_metric', userId, {
      metric,
      value,
      ...context,
    });
  }

  /**
   * Flush events to database
   */
  private async flush() {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert(
          eventsToFlush.map(event => ({
            event_type: event.event,
            user_id: (typeof event.userId === 'string' && event.userId.trim() !== '') ? event.userId : null,
            properties: event.properties || {},
            created_at: event.timestamp,
          }))
        );

      if (error) {
        console.error('[Analytics] Error flushing events:', error);
        // Re-queue failed events
        this.eventQueue.unshift(...eventsToFlush);
      }
    } catch (error) {
      console.error('[Analytics] Exception flushing events:', error);
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  /**
   * Start automatic flush interval
   */
  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop automatic flush interval (cleanup)
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining events
    this.flush();
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
