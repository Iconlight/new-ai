import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Appbar, useTheme, Chip, TextInput, FAB } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/services/supabase';

interface UserInterest {
  id: string;
  interest: string;
  is_custom: boolean;
}

const PREDEFINED_INTERESTS = [
  'Technology', 'Science', 'Philosophy', 'Art', 'Music', 'Literature', 'History',
  'Psychology', 'Health & Fitness', 'Travel', 'Cooking', 'Photography', 'Gaming',
  'Business', 'Environment', 'Politics', 'Sports', 'Movies', 'Fashion', 'Education'
];

export default function InterestsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [userInterests, setUserInterests] = useState<UserInterest[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadInterests();
    }
  }, [user]);

  const loadInterests = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_interests')
        .select('*')
        .eq('user_id', user.id);
      
      setUserInterests(data || []);
    } catch (error) {
      console.error('Error loading interests:', error);
    } finally {
      setLoading(false);
    }
  };

  const addInterest = async (interest: string, isCustom: boolean = false) => {
    if (!user || !interest.trim()) return;
    
    // Check if already exists
    if (userInterests.some(ui => ui.interest.toLowerCase() === interest.toLowerCase())) {
      Alert.alert('Already Added', 'This interest is already in your list.');
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_interests')
        .insert({
          user_id: user.id,
          interest: interest.trim(),
          is_custom: isCustom,
        })
        .select()
        .single();
      
      if (error) {
        Alert.alert('Error', 'Failed to add interest');
      } else if (data) {
        setUserInterests(prev => [...prev, data]);
        if (isCustom) {
          setNewInterest('');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const removeInterest = async (interestId: string) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_interests')
        .delete()
        .eq('id', interestId)
        .eq('user_id', user.id);
      
      if (error) {
        Alert.alert('Error', 'Failed to remove interest');
      } else {
        setUserInterests(prev => prev.filter(ui => ui.id !== interestId));
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomInterest = () => {
    if (newInterest.trim()) {
      addInterest(newInterest, true);
    }
  };

  const availablePredefined = PREDEFINED_INTERESTS.filter(
    interest => !userInterests.some(ui => ui.interest === interest)
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Manage Interests" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Your Interests ({userInterests.length})
            </Text>
            
            {userInterests.length > 0 ? (
              <View style={styles.chipsContainer}>
                {userInterests.map((interest) => (
                  <Chip
                    key={interest.id}
                    mode="flat"
                    onClose={() => removeInterest(interest.id)}
                    style={[
                      styles.chip,
                      interest.is_custom && { backgroundColor: theme.colors.secondaryContainer }
                    ]}
                    closeIcon="close"
                  >
                    {interest.interest}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No interests added yet. Add some below to personalize your experience!
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Add Custom Interest
            </Text>
            
            <TextInput
              mode="outlined"
              label="Enter a custom interest"
              value={newInterest}
              onChangeText={setNewInterest}
              onSubmitEditing={handleAddCustomInterest}
              right={
                <TextInput.Icon 
                  icon="plus" 
                  onPress={handleAddCustomInterest}
                  disabled={!newInterest.trim() || saving}
                />
              }
              style={styles.textInput}
            />
          </Card.Content>
        </Card>

        {availablePredefined.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Suggested Interests
              </Text>
              
              <View style={styles.chipsContainer}>
                {availablePredefined.map((interest) => (
                  <Chip
                    key={interest}
                    mode="outlined"
                    onPress={() => addInterest(interest)}
                    disabled={saving}
                    style={styles.chip}
                  >
                    {interest}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              About Interests
            </Text>
            
            <Text variant="bodyMedium" style={styles.infoText}>
              • Interests help AI generate personalized conversation starters
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • They're used for networking compatibility matching
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • Custom interests allow for more specific personalization
            </Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              • You can add or remove interests anytime
            </Text>
          </Card.Content>
        </Card>
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
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
    fontStyle: 'italic',
    padding: 16,
  },
  textInput: {
    marginBottom: 8,
  },
  infoText: {
    marginBottom: 6,
    opacity: 0.8,
  },
});
