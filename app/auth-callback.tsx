import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/services/supabase';
import AnimatedLoading from '../components/ui/AnimatedLoading';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Extract all relevant params from URL
        const code = params.code as string;
        const error = params.error as string;
        const errorDescription = params.error_description as string;
        const state = params.state as string;

        console.log('Auth callback params:', { code: !!code, error, state: !!state });

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

        console.log('Exchanging code for session with PKCE...');
        
        // For React Native, we need to reconstruct the URL with all params
        const baseUrl = 'proactiveai://auth-callback';
        const urlParams = new URLSearchParams();
        
        // Add all received params to reconstruct the full callback URL
        Object.entries(params).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            urlParams.append(key, value);
          }
        });
        
        const fullUrl = `${baseUrl}?${urlParams.toString()}`;
        console.log('Reconstructed callback URL for session exchange');
        
        // Use getSessionFromUrl which handles PKCE properly
        const sessionResult = await supabase.auth.getSessionFromUrl({ url: fullUrl });
        
        if (sessionResult.error) {
          console.error('Session exchange error:', sessionResult.error);
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { error: sessionResult.error.message }
          });
          return;
        }

        console.log('Google sign-in successful, redirecting to app...');
        // Navigate to main app - let the index screen handle onboarding check
        router.replace('/');
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

  return <AnimatedLoading message="Completing sign-in..." />;
}
