import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Text, TextInput, Surface } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function SignUp() {
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
  
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      Alert.alert('Sign Up Error', error);
    } else {
      Alert.alert(
        'Success', 
        'Account created successfully! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => router.push('/onboarding') }]
      );
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
            Create Account
          </Text>
        
        <TextInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          mode="outlined"
          style={styles.input}
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
        
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry={!showConfirmPassword}
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
              icon={showConfirmPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowConfirmPassword(v => !v)}
              forceTextInputFocus={false}
              iconColor="rgba(255,255,255,0.7)"
            />
          }
        />
        
        <Button
          mode="contained"
          onPress={handleSignUp}
          loading={loading}
          disabled={loading}
          style={[styles.button, styles.primaryButton]}
          buttonColor="#8B5CF6"
          textColor="#FFFFFF"
        >
          Create Account
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
              // Let the auth state change handle navigation
              // This will check onboarding status and redirect appropriately
              router.replace('/');
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
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.linkButton}
        >
          Already have an account? Sign In
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
