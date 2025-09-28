import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Switch, Card, Button, Appbar, useTheme, Chip, SegmentedButtons } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { updateNetworkingPreferences } from '../../src/services/networking';
import { supabase } from '../../src/services/supabase';

export default function NetworkingSettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [networkingEnabled, setNetworkingEnabled] = useState(true);
  const [visibilityLevel, setVisibilityLevel] = useState<'public' | 'limited' | 'private'>('limited');
  const [maxMatchesPerDay, setMaxMatchesPerDay] = useState(5);
  const [minimumCompatibility, setMinimumCompatibility] = useState(60);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: preferences } = await supabase
        .from('user_networking_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (preferences) {
        setNetworkingEnabled(preferences.is_networking_enabled);
        setVisibilityLevel(preferences.visibility_level);
        setMaxMatchesPerDay(preferences.max_matches_per_day);
        setMinimumCompatibility(preferences.minimum_compatibility_score);
      }
    } catch (error) {
      console.error('Error loading networking settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const success = await updateNetworkingPreferences(user.id, {
        isNetworkingEnabled: networkingEnabled,
        visibilityLevel,
        maxMatchesPerDay,
        minimumCompatibilityScore: minimumCompatibility
      });
      
      if (success) {
        Alert.alert('Success', 'Settings saved successfully!');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
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
        <Appbar.Header style={styles.glassHeader}>
          <Appbar.BackAction color="#ffffff" onPress={() => router.back()} />
          <Appbar.Content title="Networking Settings" titleStyle={{ color: '#ffffff' }} />
        </Appbar.Header>

        <ScrollView style={styles.content}>
          <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="bodyLarge">Enable AI Networking</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Allow AI to analyze your conversations for matching
                </Text>
              </View>
              <Switch 
                value={networkingEnabled} 
                onValueChange={setNetworkingEnabled}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="bodyLarge">Visibility Level</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Who can see your profile for matching
                </Text>
              </View>
            </View>
            
            <View style={styles.chipContainer}>
              <Chip 
                mode={visibilityLevel === 'public' ? 'flat' : 'outlined'}
                onPress={() => setVisibilityLevel('public')}
                style={styles.chip}
              >
                Public
              </Chip>
              <Chip 
                mode={visibilityLevel === 'limited' ? 'flat' : 'outlined'}
                onPress={() => setVisibilityLevel('limited')}
                style={styles.chip}
              >
                Limited
              </Chip>
              <Chip 
                mode={visibilityLevel === 'private' ? 'flat' : 'outlined'}
                onPress={() => setVisibilityLevel('private')}
                style={styles.chip}
              >
                Private
              </Chip>
            </View>
          </Card.Content>
          </Card>

          <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Matching Preferences
            </Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="bodyLarge">Daily Match Limit</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Maximum new matches per day: {maxMatchesPerDay}
                </Text>
              </View>
            </View>
            
            <View style={styles.segmentedContainer}>
              <SegmentedButtons
                value={maxMatchesPerDay.toString()}
                onValueChange={(value) => setMaxMatchesPerDay(parseInt(value))}
                buttons={[
                  { value: '1', label: '1' },
                  { value: '3', label: '3' },
                  { value: '5', label: '5' },
                  { value: '10', label: '10' },
                ]}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="bodyLarge">Minimum Compatibility</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Only show matches above {minimumCompatibility}% compatibility
                </Text>
              </View>
            </View>
            
            <View style={styles.segmentedContainer}>
              <SegmentedButtons
                value={minimumCompatibility.toString()}
                onValueChange={(value) => setMinimumCompatibility(parseInt(value))}
                buttons={[
                  { value: '50', label: '50%' },
                  { value: '60', label: '60%' },
                  { value: '70', label: '70%' },
                  { value: '80', label: '80%' },
                ]}
              />
            </View>
          </Card.Content>
          </Card>

          <Card style={[styles.card, styles.glassCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              How AI Networking Works
            </Text>
            
            <Text variant="bodyMedium" style={styles.infoText}>
              • AI analyzes your conversation patterns and interests
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • Finds people with compatible communication styles
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • Suggests personalized conversation starters
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • You control all connections and privacy settings
            </Text>
          </Card.Content>
          </Card>

          <Button 
          mode="contained" 
          onPress={handleSaveSettings}
          loading={saving}
          disabled={saving || loading}
          style={styles.saveButton}
        >
          Save Settings
          </Button>
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
    marginBottom: 16,
    color: '#FFFFFF',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flex: 1,
  },
  infoText: {
    marginBottom: 8,
    color: 'rgba(237,233,254,0.85)',
  },
  saveButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  segmentedContainer: {
    marginBottom: 16,
  },
  glassHeader: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
