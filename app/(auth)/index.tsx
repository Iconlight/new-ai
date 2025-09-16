import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, Surface } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AuthIndex() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (session && !loading) {
      router.replace('/(tabs)');
    }
  }, [session, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text variant="headlineMedium">Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.surface} elevation={2}>
        <Text variant="headlineLarge" style={styles.title}>
          ProactiveAI
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your intelligent conversation companion
        </Text>
        
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => router.push('/(auth)/sign-up')}
            style={styles.button}
          >
            Get Started
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.button}
          >
            Sign In
          </Button>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  surface: {
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.7,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    marginVertical: 6,
  },
});
