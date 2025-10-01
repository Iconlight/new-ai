import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import AnimatedLoading from '../components/ui/AnimatedLoading';

/**
 * OAuth callback screen - This handles the deep link redirect
 * When using WebBrowser.openAuthSessionAsync, this screen is shown briefly
 * The AuthContext handles the actual authentication, so this just shows a loading state
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('[AuthCallback] OAuth callback screen loaded');
        console.log('[AuthCallback] Params:', Object.keys(params));

        // Check for OAuth errors
        const error_param = params.error as string;
        if (error_param) {
          console.error('[AuthCallback] OAuth error:', error_param);
          router.replace({
            pathname: '/(auth)/sign-in',
            params: { error: params.error_description as string || error_param }
          });
          return;
        }

        // The AuthContext.signInWithGoogle handles the token exchange
        // Just show loading - the auth state change will trigger navigation from index.tsx
        console.log('[AuthCallback] Auth processing in progress...');
      } catch (error) {
        console.error('[AuthCallback] Callback processing error:', error);
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
