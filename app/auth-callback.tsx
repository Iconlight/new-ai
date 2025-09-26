import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/services/supabase';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Extract code from URL params
        const code = params.code as string;
        const error = params.error as string;
        const errorDescription = params.error_description as string;

        if (error) {
          console.error('OAuth error:', error, errorDescription);
          // Navigate back to sign-in with error
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { error: errorDescription || error }
          });
          return;
        }

        if (!code) {
          console.error('No authorization code received');
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { error: 'No authorization code received' }
          });
          return;
        }

        console.log('Exchanging code for session...');
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Code exchange error:', exchangeError);
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { error: exchangeError.message }
          });
          return;
        }

        console.log('Google sign-in successful, redirecting to app...');
        // Navigate to main app
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace({
          pathname: '/(auth)/sign-in',
          params: { error: 'Authentication failed' }
        });
      }
    };

    handleAuthCallback();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator animating size="large" />
      <Text style={styles.text}>Completing sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    textAlign: 'center',
  },
});
