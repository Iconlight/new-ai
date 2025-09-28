import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Switch, Card, Button, Appbar, useTheme, List, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useNotification } from '../src/contexts/NotificationContext';
import { supabase } from '../src/services/supabase';
import * as Notifications from 'expo-notifications';

export default function NotificationsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { generateDailyConversations } = useNotification();
  const [preferences, setPreferences] = useState({
    notification_enabled: true,
    daily_conversation_count: 4,
  });
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
      checkNotificationPermissions();
    }
  }, [user]);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
  };

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    
    if (status === 'granted') {
      Alert.alert('Success', 'Notification permissions granted!');
    } else {
      Alert.alert('Permissions Denied', 'You can enable notifications in your device settings.');
    }
  };

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setPreferences({
          notification_enabled: data.notification_enabled ?? true,
          daily_conversation_count: data.daily_conversation_count ?? 4,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        Alert.alert('Error', 'Failed to update preference');
      } else {
        setPreferences(prev => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateNow = async () => {
    setLoading(true);
    try {
      await generateDailyConversations();
      Alert.alert('Success', 'New conversation starters have been generated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate conversations');
    } finally {
      setLoading(false);
    }
  };

  const testNotification = async () => {
    if (permissionStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Please enable notification permissions first.');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ProactiveAI Test',
        body: 'This is a test notification. Your notifications are working!',
        data: { test: true },
      },
      trigger: { 
        seconds: 1 
      } as any,
    });

    Alert.alert('Test Sent', 'A test notification will appear shortly.');
  };
  // Page removed: redirect away
  useEffect(() => {
    router.replace('/settings');
  }, []);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  testButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 8,
  },
  actionButton: {
    marginBottom: 8,
  },
  infoText: {
    marginBottom: 6,
    opacity: 0.8,
  },
});
