import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text, Surface, Chip, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/services/supabase';
import { PREDEFINED_INTERESTS } from '../src/types';

export default function Onboarding() {
  const { user, checkOnboardingStatus } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !selectedInterests.includes(customInterest.trim())) {
      setSelectedInterests(prev => [...prev, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const saveInterests = async () => {
    if (!user || selectedInterests.length === 0) {
      Alert.alert('Error', 'Please select at least one interest');
      return;
    }

    setLoading(true);

    try {
      const interestData = selectedInterests.map(interest => ({
        user_id: user.id,
        interest,
        is_custom: !PREDEFINED_INTERESTS.includes(interest),
      }));

      const { error } = await supabase
        .from('user_interests')
        .insert(interestData);

      if (error) {
        Alert.alert('Error', 'Failed to save interests');
        console.error('Error saving interests:', error);
      } else {
        // Refresh onboarding status and navigate to discover
        await checkOnboardingStatus();
        router.replace('/discover');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Error saving interests:', error);
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }] }>
        <Surface style={[styles.surface, styles.glassCard]} elevation={0}>
          <Text variant="headlineMedium" style={[styles.title, { color: '#FFFFFF' }]}> 
            Tell us about your interests
          </Text>
          <Text variant="bodyLarge" style={[styles.subtitle, { color: 'rgba(237,233,254,0.8)' }]}> 
            This helps us create personalized conversations for you
          </Text>

        <Text variant="titleMedium" style={[styles.sectionTitle, { color: '#FFFFFF' }]}> 
          Popular Interests
        </Text>
        <View style={styles.chipContainer}>
          {PREDEFINED_INTERESTS.map(interest => (
            <Chip
              key={interest}
              selected={selectedInterests.includes(interest)}
              onPress={() => toggleInterest(interest)}
              style={styles.chip}
            >
              {interest}
            </Chip>
          ))}
        </View>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Add Custom Interest
        </Text>
        
        <View style={styles.customInterestContainer}>
          <TextInput
            label="Your interest"
            value={customInterest}
            onChangeText={setCustomInterest}
            mode="outlined"
            style={styles.customInput}
            onSubmitEditing={addCustomInterest}
          />
          <Button
            mode="outlined"
            onPress={addCustomInterest}
            disabled={!customInterest.trim()}
            style={styles.addButton}
          >
            Add
          </Button>
        </View>

        {selectedInterests.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Selected Interests ({selectedInterests.length})
            </Text>
            <View style={styles.chipContainer}>
              {selectedInterests.map(interest => (
                <Chip
                  key={interest}
                  selected
                  onClose={() => toggleInterest(interest)}
                  style={styles.chip}
                >
                  {interest}
                </Chip>
              ))}
            </View>
          </>
        )}

        <Button
          mode="contained"
          onPress={saveInterests}
          loading={loading}
          disabled={loading || selectedInterests.length === 0}
          style={styles.saveButton}
        >
          Continue
        </Button>
        </Surface>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  gradientBg: {
    flex: 1,
  },
  surface: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center',
    color: 'rgba(237,233,254,0.8)',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 16,
    color: '#FFFFFF',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginBottom: 8,
  },
  customInterestContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  customInput: {
    flex: 1,
  },
  addButton: {
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 32,
    marginBottom: 16,
  },
});
