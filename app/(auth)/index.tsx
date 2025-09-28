import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      >
        <View style={styles.container}>
          <Text variant="headlineMedium" style={{ color: '#FFFFFF' }}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={styles.container}>
        <Surface style={[styles.surface, styles.glassCard]} elevation={0}>
          <Text variant="headlineLarge" style={[styles.title, { color: '#FFFFFF' }]}>ProactiveAI</Text>
          <Text variant="bodyLarge" style={[styles.subtitle, { color: 'rgba(237,233,254,0.8)' }]}>Your intelligent conversation companion</Text>
          
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gradientBg: {
    flex: 1,
  },
  surface: {
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    marginVertical: 6,
  },
});
