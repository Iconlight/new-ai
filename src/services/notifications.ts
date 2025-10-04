import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  // Skip notifications on web platform
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web platform');
    return null;
  }

  let token = null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }
    
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
    
    if (projectId && projectId !== 'your_expo_project_id_here') {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      console.log('Expo project ID not configured');
    }
  } catch (e) {
    console.error('Error getting push token:', e);
  }

  return token;
};

export const scheduleDailyNotifications = async (conversationStarters: string[]) => {
  // Skip notifications on web platform
  if (Platform.OS === 'web') {
    console.log('Notification scheduling not supported on web platform');
    return;
  }

  try {
    // Cancel existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule 4 notifications per day as requested
    const now = new Date();
    const times = [
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),  // 9 AM
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0), // 1 PM
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0), // 5 PM
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0), // 8 PM
    ];

    const titles = [
      'Good Morning! 🌅',
      'Afternoon Thoughts 🤔',
      'Evening Reflection 🌆',
      'Night Chat 🌙'
    ];

    for (let i = 0; i < Math.min(conversationStarters.length, 4); i++) {
      const scheduledTime = times[i];
      
      // Only schedule if the time hasn't passed today
      if (scheduledTime > now) {
        const secondsFromNow = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: titles[i] || 'Let\'s Chat! 💬',
            body: conversationStarters[i],
            data: { 
              conversationStarter: conversationStarters[i],
              notificationTime: scheduledTime.toISOString(),
              index: i
            },
            sound: 'default',
            ...(Platform.OS === 'android' && {
              android: {
                icon: './assets/images/notification-icon.png',
                color: '#8B5CF6',
              },
            }),
          },
          trigger: {
            type: 'timeInterval',
            seconds: secondsFromNow,
          } as any,
        });
        
        console.log(`Scheduled notification ${i + 1} for ${scheduledTime.toLocaleTimeString()}`);
      } else {
        console.log(`Skipping notification ${i + 1} - time has passed (${scheduledTime.toLocaleTimeString()})`);
      }
    }
    
    // Schedule notifications for tomorrow if we have more starters
    if (conversationStarters.length > 4) {
      await scheduleNextDayNotifications(conversationStarters.slice(4));
    }
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

export const scheduleNextDayNotifications = async (conversationStarters: string[]) => {
  // Skip notifications on web platform
  if (Platform.OS === 'web') {
    console.log('Notification scheduling not supported on web platform');
    return;
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const times = [
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0),  // 9 AM
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 13, 0), // 1 PM
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 17, 0), // 5 PM
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 20, 0), // 8 PM
    ];

    const titles = [
      'Good Morning! 🌅',
      'Afternoon Thoughts 🤔',
      'Evening Reflection 🌆',
      'Night Chat 🌙'
    ];

    for (let i = 0; i < Math.min(conversationStarters.length, 4); i++) {
      const scheduledTime = times[i];
      const now = new Date();
      const secondsFromNow = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: titles[i] || 'Let\'s Chat! 💬',
          body: conversationStarters[i],
          data: { 
            conversationStarter: conversationStarters[i],
            notificationTime: scheduledTime.toISOString(),
            index: i,
            nextDay: true
          },
        },
        trigger: {
          type: 'timeInterval',
          seconds: secondsFromNow,
        } as any,
      });
      
      console.log(`Scheduled next day notification ${i + 1} for ${scheduledTime.toLocaleString()}`);
    }
  } catch (error) {
    console.error('Error scheduling next day notifications:', error);
  }
};
