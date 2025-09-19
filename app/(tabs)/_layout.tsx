import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';

export default function TabLayout() {
  const theme = useTheme();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!session && !loading) {
      router.replace('/(auth)');
    }
  }, [session, loading]);

  if (!session) {
    return null;
  }

  // Still provide the tabs layout for chat routes, but hide the tab bar
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hide tab bar since we use top navigation
      }}>
      <Tabs.Screen
        name="index"
        options={{ 
          href: null, // Hide from navigation
          // Redirect to discover when this route is accessed
        }}
      />
      <Tabs.Screen
        name="chat/[id]"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{ href: null }} // Hide from navigation
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null }} // Hide from navigation
      />
    </Tabs>
  );
}
