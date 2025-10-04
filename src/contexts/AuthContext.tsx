import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL } from '../services/supabase';
import { User } from '../types';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Linking } from 'react-native';
import Constants from 'expo-constants';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  needsOnboarding: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  checkOnboardingStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('[Auth] Initializing authentication...');
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
        }
        
        if (isMounted) {
          if (session?.user) {
            console.log('[Auth] Found existing session for user:', session.user.id);
            setSession(session);
            await fetchUserProfile(session.user);
          } else {
            console.log('[Auth] No existing session found');
            setSession(null);
            setUser(null);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event, session?.user?.id || 'no user');
      
      if (isMounted) {
        setSession(session);
        if (session?.user) {
          console.log('[Auth] Fetching user profile after auth state change...');
          setLoading(true); // Keep loading true while fetching profile
          await fetchUserProfile(session.user);
          console.log('[Auth] Profile fetch completed');
        } else {
          setUser(null);
          setNeedsOnboarding(false);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkOnboardingStatus = async (): Promise<boolean> => {
    if (!session?.user?.id) return false;
    
    try {
      console.log('[Auth] Checking onboarding status for user:', session.user.id);
      const { data, error } = await supabase
        .from('user_interests')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (error) {
        console.error('[Auth] Error checking onboarding status:', error);
        return false;
      }

      // User needs onboarding if they have no interests
      const needsOnboarding = !data || data.length === 0;
      console.log('[Auth] User needs onboarding:', needsOnboarding);
      setNeedsOnboarding(needsOnboarding);
      return needsOnboarding;
    } catch (error) {
      console.error('[Auth] Error checking onboarding status:', error);
      return false;
    }
  };

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('[Auth] === FETCH USER PROFILE START ===');
      console.log('[Auth] Fetching profile for user:', authUser.id);
      console.log('[Auth] User email:', authUser.email);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => {
          console.error('[Auth] Profile fetch timeout after 10 seconds');
          resolve({ data: null, error: { code: 'TIMEOUT', message: 'Profile fetch timeout' } });
        }, 10000)
      );
      
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      console.log('[Auth] Profile query completed. Error:', error?.message || 'none', 'Data:', data ? 'found' : 'not found');

      if (error) {
        // Handle timeout - profile might exist but query timed out
        if (error.code === 'TIMEOUT') {
          console.error('[Auth] Profile query timed out. Trying to check onboarding status...');
          
          // Set minimal user data from auth metadata
          const minimalUser = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
            avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          setUser(minimalUser as any);
          
          // Try to check if user has interests (this query might succeed even if profile query timed out)
          try {
            const needsOnboarding = await checkOnboardingStatus();
            console.log('[Auth] Onboarding check after timeout:', needsOnboarding);
            setNeedsOnboarding(needsOnboarding);
          } catch (err) {
            console.error('[Auth] Onboarding check also failed, assuming needs onboarding');
            setNeedsOnboarding(true);
          }
          
          setLoading(false);
          return;
        }
        
        // Profile doesn't exist (first-time Google sign-in)
        if (error.code === 'PGRST116') {
          console.log('[Auth] Profile not found, creating new profile...');
          
          // Create profile from auth metadata
          const fullName = authUser.user_metadata?.full_name || 
                          authUser.user_metadata?.name || 
                          authUser.email?.split('@')[0] || 
                          'User';
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              full_name: fullName,
              avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
            })
            .select()
            .single();
          
          if (createError) {
            console.error('[Auth] Error creating profile:', createError);
            setLoading(false);
            return;
          }
          
          console.log('[Auth] Profile created successfully:', fullName);
          setUser(newProfile);
          
          // Check onboarding status for new profile
          const needsOnboarding = await checkOnboardingStatus();
          console.log('[Auth] New user needs onboarding:', needsOnboarding);
          setNeedsOnboarding(needsOnboarding);
          setLoading(false);
          return;
        }
        
        console.error('[Auth] Error fetching profile:', error);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('[Auth] Profile fetched successfully:', data.full_name || data.email);
        setUser(data);
        // Check if user needs onboarding
        const needsOnboarding = await checkOnboardingStatus();
        console.log('[Auth] Existing user needs onboarding:', needsOnboarding);
        setNeedsOnboarding(needsOnboarding);
        setLoading(false);
      } else {
        console.log('[Auth] No profile data found');
        setLoading(false);
      }
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error);
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('Auth.signUp -> using Supabase URL:', SUPABASE_URL);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('Auth.signUp error:', error);
        return { error: error.message };
      }

      return {};
    } catch (error) {
      console.error('Auth.signUp network/unknown error:', error);
      return { error: error instanceof Error ? error.message : 'Network error during sign up' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Auth.signIn -> using Supabase URL:', SUPABASE_URL);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Auth.signIn error:', error);
        return { error: error.message };
      }

      return {};
    } catch (error) {
      console.error('Auth.signIn network/unknown error:', error);
      return { error: error instanceof Error ? error.message : 'Network error during sign in' };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Determine the correct redirect URI based on environment
      // For Expo Go: use native scheme, for standalone: use custom scheme
      const isExpoGo = Constants.appOwnership === 'expo';
      
      const redirectTo = makeRedirectUri({
        scheme: isExpoGo ? undefined : 'proactiveai', // undefined uses native Expo Go scheme
        path: 'auth-callback',
      });
      
      console.log('=== GOOGLE AUTH DEBUG ===');
      console.log('Environment:', isExpoGo ? 'Expo Go' : 'Standalone');
      console.log('Redirect URI:', redirectTo);
      console.log('========================');
      console.log('⚠️ IMPORTANT: Add this URL to Supabase Dashboard:');
      console.log('   Authentication > URL Configuration > Redirect URLs');
      console.log('   Add:', redirectTo);
      console.log('========================');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Auth.signInWithGoogle error:', error);
        return { error: error.message };
      }

      if (!data?.url) {
        return { error: 'Unable to start Google sign-in' };
      }

      console.log('Opening OAuth URL:', data.url);
      console.log('Expected redirect URI:', redirectTo);

      // Open the OAuth URL and handle the response
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
        {
          showInRecents: true,
          preferEphemeralSession: false, // Use persistent session for better compatibility
        }
      );
      
      console.log('WebBrowser result type:', result.type);
      if (result.type === 'success') {
        console.log('WebBrowser result URL:', result.url);
      }
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('User cancelled or dismissed the sign-in');
        return { error: 'Google sign-in was cancelled' };
      }

      if (result.type === 'success') {
        console.log('Processing OAuth response...');
        
        // With implicit flow, tokens are in the URL hash or query params
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token') || 
                           url.hash.match(/access_token=([^&]+)/)?.[1];
        const refreshToken = url.searchParams.get('refresh_token') || 
                            url.hash.match(/refresh_token=([^&]+)/)?.[1];
        
        if (accessToken) {
          console.log('Setting session with access token...');
          
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            return { error: sessionError.message };
          }

          if (sessionData?.session) {
            console.log('Google session created successfully:', sessionData.session.user?.id);
            return {};
          }
        } else {
          console.error('No access token in OAuth response');
          return { error: 'Failed to get access token from Google' };
        }
      }
      
      return { error: 'Authentication flow incomplete' };
    } catch (error) {
      console.error('Auth.signInWithGoogle network/unknown error:', error);
      return { error: error instanceof Error ? error.message : 'Network error during Google sign in' };
    }
  };

  const signOut = async () => {
    console.log('[Auth] Signing out user');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] Error signing out:', error);
    } else {
      console.log('[Auth] User signed out successfully');
    }
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    needsOnboarding,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
    checkOnboardingStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
