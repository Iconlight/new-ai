import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text, TextInput, Surface } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function SignIn() {
  const { signIn, signInWithGoogle } = useAuth();
  const params = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Show OAuth error if redirected from auth-callback
  useEffect(() => {
    if (params.error) {
      Alert.alert('Authentication Error', params.error as string);
    }
  }, [params.error]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      Alert.alert('Sign In Error', error);
    } else {
      router.replace('/(tabs)');
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={styles.container}> 
        <Surface style={[styles.surface, styles.glassCard]} elevation={0}>
          <Text variant="headlineMedium" style={[styles.title, { color: '#FFFFFF' }]}> 
            Welcome Back
          </Text>
        
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          theme={{
            colors: {
              primary: '#8B5CF6',
              outline: 'rgba(255,255,255,0.3)',
              onSurfaceVariant: 'rgba(255,255,255,0.7)',
              onSurface: '#FFFFFF',
              surface: 'rgba(255,255,255,0.08)',
              surfaceVariant: 'rgba(255,255,255,0.08)',
            }
          }}
        />
        
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showPassword}
          theme={{
            colors: {
              primary: '#8B5CF6',
              outline: 'rgba(255,255,255,0.3)',
              onSurfaceVariant: 'rgba(255,255,255,0.7)',
              onSurface: '#FFFFFF',
              surface: 'rgba(255,255,255,0.08)',
              surfaceVariant: 'rgba(255,255,255,0.08)',
            }
          }}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(v => !v)}
              forceTextInputFocus={false}
              iconColor="rgba(255,255,255,0.7)"
            />
          }
        />
        
        <Button
          mode="contained"
          onPress={handleSignIn}
          loading={loading}
          disabled={loading}
          style={[styles.button, styles.primaryButton]}
          buttonColor="#8B5CF6"
          textColor="#FFFFFF"
        >
          Sign In
        </Button>
        
        <Button
          mode="outlined"
          onPress={async () => {
            setLoading(true);
            const { error } = await signInWithGoogle();
            setLoading(false);
            if (error) {
              Alert.alert('Google Sign-In Error', error);
            } else {
              router.replace('/(tabs)');
            }
          }}
          disabled={loading}
          style={[styles.button, styles.outlinedButton]}
          textColor="#FFFFFF"
        >
          Continue with Google
        </Button>
        
        <Button
          mode="text"
          onPress={() => router.push('/(auth)/sign-up')}
          style={styles.linkButton}
        >
          Don't have an account? Sign Up
        </Button>
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
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  outlinedButton: {
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  linkButton: {
    marginTop: 8,
  },
});
