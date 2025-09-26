import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { generateAndScheduleProactiveConversations } from '../services/proactiveAI';
import { useAuth } from './AuthContext';

// Safely import expo-notifications with fallback
let Notifications: any = null;
let registerForPushNotificationsAsync: any = null;

try {
  Notifications = require('expo-notifications');
  registerForPushNotificationsAsync = require('../services/notifications').registerForPushNotificationsAsync;
} catch (error) {
  console.warn('Notifications not available in this environment:', error);
}

interface NotificationContextType {
  expoPushToken: string | null;
  notification: any | null;
  generateDailyConversations: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);

  useEffect(() => {
    // Skip notifications in Expo Go or if not available
    if (!Notifications || !registerForPushNotificationsAsync) {
      console.log('Notifications not available - skipping initialization');
      return;
    }

    const initializeNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setExpoPushToken(token);
        }
        
        // Auto-schedule daily notifications if user has enabled them
        if (user) {
          await checkAndScheduleDailyNotifications();
        }
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    };

    initializeNotifications();

    // Listen for notifications with error handling
    let notificationListener: any;
    let responseListener: any;

    try {
      notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
        console.log('Notification received:', notification);
        setNotification(notification);
      });

      responseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('Notification response:', response);
        
        // Handle notification tap based on type
        const notificationData = response.notification?.request?.content?.data;
        if (notificationData?.type === 'networking_message') {
          // Navigate to networking chat
          const { router } = require('expo-router');
          const { conversationId, senderName } = notificationData;
          router.push({
            pathname: `/networking/chat/${conversationId}`,
            params: { name: senderName || 'User' }
          });
        } else if (notificationData?.conversationStarter) {
          // Handle regular conversation starter notifications
          const { router } = require('expo-router');
          router.push('/discover'); // Navigate to discover to see conversation starters
        }
      });
    } catch (error) {
      console.error('Failed to set up notification listeners:', error);
    }

    return () => {
      try {
        if (notificationListener) {
          notificationListener.remove();
        }
        if (responseListener) {
          responseListener.remove();
        }
      } catch (error) {
        console.error('Failed to cleanup notification listeners:', error);
      }
    };
  }, [user]);

  const checkAndScheduleDailyNotifications = async () => {
    if (!user || !Notifications) return;

    try {
      // Check if user has notifications enabled
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('notification_enabled')
        .eq('user_id', user.id)
        .single();

      if (preferences?.notification_enabled !== false) { // Default to enabled
        // Check if we already have notifications scheduled for today
        const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const today = new Date().toDateString();
        
        const hasNotificationsForToday = scheduledNotifications.some((notification: any) => {
          const triggerValue = notification.trigger?.value || notification.trigger?.seconds;
          if (!triggerValue) return false;
          const notificationDate = new Date(Date.now() + (triggerValue * 1000)).toDateString();
          return notificationDate === today;
        });

        if (!hasNotificationsForToday) {
          console.log('No notifications scheduled for today, generating new ones...');
          await generateDailyConversations();
        } else {
          console.log(`Already have ${scheduledNotifications.length} notifications scheduled`);
        }
      }
    } catch (error) {
      console.error('Error checking daily notifications:', error);
    }
  };

  const generateDailyConversations = async () => {
    if (!user) return;

    try {
      // Use the new feed-based system to generate and schedule notifications
      const { getActiveFeedTopics, refreshInterestsFeed, refreshForYouFeed } = await import('../services/feedService');
      const { scheduleDailyNotifications } = await import('../services/notifications');
      
      // Refresh both feeds to get fresh content
      await Promise.all([
        refreshInterestsFeed(user.id),
        refreshForYouFeed(user.id)
      ]);
      
      // Get topics from both feeds
      const [interestsTopics, forYouTopics] = await Promise.all([
        getActiveFeedTopics(user.id, 'interests'),
        getActiveFeedTopics(user.id, 'foryou')
      ]);
      
      // Combine and format topics for notifications
      const allTopics = [...interestsTopics, ...forYouTopics];
      const conversationStarters = allTopics
        .slice(0, 4) // Get 4 topics for daily notifications
        .map(topic => {
          // Format the topic message for notifications
          let message = topic.message;
          try {
            // Try to parse if it's JSON
            if (message.includes('[') || message.includes('{')) {
              const parsed = JSON.parse(message.replace(/```json|```/g, ''));
              if (Array.isArray(parsed) && parsed.length > 0) {
                message = typeof parsed[0] === 'string' ? parsed[0] : parsed[0]?.text || message;
              }
            }
          } catch {
            // Use original message if parsing fails
          }
          
          // Clean up the message
          message = message.replace(/^\[+\s*/, '').replace(/\s*\]+$/, '');
          message = message.replace(/^"+\s*/, '').replace(/\s*"+$/, '');
          
          return message || `Let's chat about ${topic.topic}!`;
        });
      
      if (conversationStarters.length > 0) {
        await scheduleDailyNotifications(conversationStarters);
        console.log(`Scheduled ${conversationStarters.length} daily notifications`);
      }
    } catch (error) {
      console.error('Error generating daily conversations:', error);
    }
  };

  const value: NotificationContextType = {
    expoPushToken,
    notification,
    generateDailyConversations,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
