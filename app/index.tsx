import { router } from 'expo-router';
import React, { useEffect } from 'react';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import { useAuth } from '../src/contexts/AuthContext';

export default function IndexScreen() {
  const { session, loading, needsOnboarding } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (session) {
        if (needsOnboarding) {
          console.log('[Index] User needs onboarding, redirecting to onboarding');
          router.replace('/onboarding');
        } else {
          console.log('[Index] User authenticated, redirecting to discover');
          router.replace('/discover');
        }
      } else {
        console.log('[Index] No session, redirecting to auth');
        router.replace('/(auth)');
      }
    }
  }, [session, loading, needsOnboarding]);

  return <AnimatedLoading message="Initializing ProactiveAI..." />;
}
