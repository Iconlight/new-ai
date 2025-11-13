import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import AnimatedLoading from '../components/ui/AnimatedLoading';
import { useAuth } from '../src/contexts/AuthContext';

export default function IndexScreen() {
  const { session, loading, needsOnboarding } = useAuth();
  const hasRedirected = useRef(false);

  useEffect(() => {
    console.log('[Index] State check - loading:', loading, 'session:', !!session, 'needsOnboarding:', needsOnboarding, 'hasRedirected:', hasRedirected.current);
    
    // Only redirect once to prevent navigation loops
    if (!loading && !hasRedirected.current) {
      if (session) {
        if (needsOnboarding) {
          console.log('[Index] User needs onboarding, redirecting to onboarding');
          hasRedirected.current = true;
          router.replace('/onboarding');
        } else {
          console.log('[Index] User authenticated, redirecting to discover');
          hasRedirected.current = true;
          router.replace('/discover');
        }
      } else {
        console.log('[Index] No session, redirecting to welcome');
        hasRedirected.current = true;
        router.replace('/welcome');
      }
    }
  }, [session, loading, needsOnboarding]);

  return <AnimatedLoading message="" />;
}
