import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Switch, Card, Button, Appbar, useTheme, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function NetworkingSettingsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [networkingEnabled, setNetworkingEnabled] = useState(true);
  const [visibilityLevel, setVisibilityLevel] = useState<'public' | 'limited' | 'private'>('limited');
  const [maxMatchesPerDay, setMaxMatchesPerDay] = useState(5);
  const [minimumCompatibility, setMinimumCompatibility] = useState(60);

  const handleSaveSettings = async () => {
    // Here you would call updateNetworkingPreferences
    console.log('Saving networking settings...');
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Networking Settings" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Privacy & Visibility
            </Text>
            
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

        <Card style={styles.card}>
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

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text variant="bodyLarge">Minimum Compatibility</Text>
                <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                  Only show matches above {minimumCompatibility}% compatibility
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
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
          style={styles.saveButton}
        >
          Save Settings
        </Button>
      </ScrollView>
    </View>
  );
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
    marginBottom: 16,
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
    opacity: 0.8,
  },
  saveButton: {
    marginTop: 16,
    marginBottom: 32,
  },
});
