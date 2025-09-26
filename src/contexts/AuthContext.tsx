import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL } from '../services/supabase';
import { User } from '../types';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Linking } from 'react-native';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error?: string }>;
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
          await fetchUserProfile(session.user);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('[Auth] Fetching profile for user:', authUser.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
      } else if (data) {
        console.log('[Auth] Profile fetched successfully:', data.full_name || data.email);
        setUser(data);
      }
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error);
    } finally {
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
      // Complete any pending auth sessions (required for iOS)
      WebBrowser.maybeCompleteAuthSession();

      // Use a simple deep link that works reliably with Expo
      const redirectTo = 'proactiveai://auth-callback';
      console.log('Auth.signInWithGoogle redirect:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
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

      // Open the OAuth URL - the auth-callback route will handle the response
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      
      if (result.type === 'cancel') {
        return { error: 'Google sign-in cancelled' };
      }
      
      // If we get here, the auth-callback route will handle the rest
      // The AuthContext will automatically update when the session changes
      return {};
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
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
