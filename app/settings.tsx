import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Text, Switch, Card, Button, useTheme, List } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/services/supabase';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    notification_enabled: true,
    daily_conversation_count: 3,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

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
          daily_conversation_count: data.daily_conversation_count ?? 3,
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
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content}>
          <Card style={[styles.card, styles.glassCard]}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Notifications
              </Text>
              <List.Item
                title="Push Notifications"
                description="Receive daily conversation starters"
                left={(props) => <List.Icon {...props} icon="bell" />}
                right={() => (
                  <Switch
                    value={preferences.notification_enabled}
                    onValueChange={(value) => updatePreference('notification_enabled', value)}
                    disabled={saving}
                  />
                )}
              />
            </Card.Content>
          </Card>

          <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Conversation Preferences
            </Text>
            
            <List.Item
              title="Daily Conversations"
              description={`Generate ${preferences.daily_conversation_count} conversation starters per day`}
              left={(props) => <List.Icon {...props} icon="chat" />}
            />
          </Card.Content>
          </Card>

          <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Account
            </Text>
            
            <List.Item
              title="Manage Interests"
              description="Update your interests and preferences"
              left={(props) => <List.Icon {...props} icon="heart" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/interests')}
            />
            
            <List.Item
              title="AI Networking"
              description="Configure networking preferences"
              onPress={() => router.push('/networking/settings')}
            />
          </Card.Content>
        </Card>

        <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              About
            </Text>
            <List.Item
              title="ProactiveAI"
              description="Version 1.0.0"
              left={(props) => <List.Icon {...props} icon="information" />}
            />
            <List.Item
              title="Privacy Policy"
              description="Learn about data handling"
              left={(props) => <List.Icon {...props} icon="shield-check" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {
                Alert.alert('Privacy Policy', 'Your privacy is protected. All conversations are encrypted and you control all networking connections.');
              }}
            />
          </Card.Content>
          </Card>
        </ScrollView>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 52,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
