import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../services/supabase';
import { generateAndScheduleProactiveConversations } from '../services/proactiveAI';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
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
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          setExpoPushToken(token);
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
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        setNotification(notification);
      });

      responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        // Handle notification tap - could navigate to chat or create new conversation
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

  const generateDailyConversations = async () => {
    if (!user) return;

    try {
      await generateAndScheduleProactiveConversations(user.id);
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
