import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text, Surface, List, Switch, useTheme } from 'react-native-paper';
import { useAuth } from '../../src/contexts/AuthContext';
import { useNotification } from '../../src/contexts/NotificationContext';
import { supabase } from '../../src/services/supabase';
import { UserInterest, UserPreferences } from '../../src/types';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { generateDailyConversations } = useNotification();
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load interests
      const { data: interestsData } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', user.id);

      // Load preferences
      const { data: preferencesData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setInterests(interestsData || []);
      setPreferences(preferencesData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const updateNotificationPreference = async (enabled: boolean) => {
    if (!user || !preferences) return;

    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ notification_enabled: enabled })
        .eq('user_id', user.id);

      if (error) {
        Alert.alert('Error', 'Failed to update notification preference');
      } else {
        setPreferences({ ...preferences, notification_enabled: enabled });
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleGenerateConversations = async () => {
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

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]}> 
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Profile
          </Text>
        </View>

        <Surface style={[styles.section, styles.glassCard]} elevation={0}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Account Information
          </Text>
          <List.Item
            title={user?.full_name || 'No name'}
            description="Full Name"
            left={(props) => <List.Icon {...props} icon="account" />}
          />
          <List.Item
            title={user?.email || 'No email'}
            description="Email Address"
            left={(props) => <List.Icon {...props} icon="email" />}
          />
        </Surface>

        <Surface style={[styles.section, styles.glassCard]} elevation={0}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Interests ({interests.length})
          </Text>
          {interests.length > 0 ? (
            interests.map((interest) => (
              <List.Item
                key={interest.id}
                title={interest.interest}
                description={interest.is_custom ? 'Custom' : 'Predefined'}
                left={(props) => <List.Icon {...props} icon="heart" />}
              />
            ))
          ) : (
            <Text style={styles.noData}>No interests added yet</Text>
          )}
        </Surface>

        <Surface style={[styles.section, styles.glassCard]} elevation={0}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Preferences
          </Text>
          <List.Item
            title="Push Notifications"
            description="Receive daily conversation starters"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => (
              <Switch
                value={preferences?.notification_enabled ?? true}
                onValueChange={updateNotificationPreference}
              />
            )}
          />
          <List.Item
            title="Daily Conversations"
            description={`${preferences?.daily_conversation_count || 3} per day`}
            left={(props) => <List.Icon {...props} icon="chat" />}
          />
        </Surface>

        <Surface style={[styles.section, styles.glassCard]} elevation={0}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Actions
          </Text>
          <Button
            mode="outlined"
            onPress={handleGenerateConversations}
            loading={loading}
            disabled={loading}
            style={styles.actionButton}
            icon="refresh"
          >
            Generate New Conversations
          </Button>
          <Button
            mode="contained"
            onPress={handleSignOut}
            style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
            icon="logout"
          >
            Sign Out
          </Button>
        </Surface>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  section: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  noData: {
    fontStyle: 'italic',
    color: 'rgba(237,233,254,0.8)',
    textAlign: 'center',
    padding: 16,
  },
  actionButton: {
    marginVertical: 8,
  },
});
