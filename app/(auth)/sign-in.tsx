import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
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
    <View style={styles.container}>
      <Surface style={styles.surface} elevation={2}>
        <Text variant="headlineMedium" style={styles.title}>
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
        />
        
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showPassword}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(v => !v)}
              forceTextInputFocus={false}
            />
          }
        />
        
        <Button
          mode="contained"
          onPress={handleSignIn}
          loading={loading}
          disabled={loading}
          style={styles.button}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  surface: {
    padding: 30,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  linkButton: {
    marginTop: 8,
  },
});
