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

// Ensure Android has a default notification channel with high importance
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#8B5CF6',
  }).catch(() => {});
}

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

export const scheduleDailyNotifications = async (
  conversationStarters: string[],
  count: number = 3
) => {
  // Skip notifications on web platform
  if (Platform.OS === 'web') {
    console.log('Notification scheduling not supported on web platform');
    return;
  }

  try {
    // Cancel all previously scheduled local notifications to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Define 3 daily times by default
    const hours = [9, 13, 18]; // 9 AM, 1 PM, 6 PM
    const titles = [
      'Good Morning! 🌅',
      'Afternoon Thoughts 🤔',
      'Evening Reflection 🌆',
    ];

    const total = Math.min(conversationStarters.length, Math.max(1, count), hours.length);

    for (let i = 0; i < total; i++) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: titles[i] || 'Let\'s Chat! 💬',
          body: conversationStarters[i],
          data: {
            type: 'daily_news',
            conversationStarter: conversationStarters[i],
            index: i,
          },
          sound: 'default',
        },
        // Calendar-based daily repeating trigger at specific hour/minute
        trigger: {
          hour: hours[i],
          minute: 0,
          repeats: true,
          channelId: 'default',
        } as any,
      });

      console.log(`Scheduled repeating daily notification ${i + 1} at ${hours[i]}:00`);
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
