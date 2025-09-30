import React, { useEffect } from 'react';
import { router } from 'expo-router';
import AnimatedLoading from '../components/ui/AnimatedLoading';

export default function AuthCallbackScreen() {
  useEffect(() => {
    // This route is now mainly a fallback - the actual OAuth handling
    // is done directly in the AuthContext.signInWithGoogle method
    console.log('Auth callback screen reached - redirecting to main app');
    
    // Small delay to ensure any auth state changes have processed
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return <AnimatedLoading message="Completing sign-in..." />;
}
