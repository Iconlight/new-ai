import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Button, useTheme, Avatar } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
        {/* Floating Header */}
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content}>
        <Card style={[styles.profileCard, styles.glassCard]}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Text 
              size={80} 
              label={user?.full_name?.charAt(0) || 'U'} 
              style={styles.avatar}
            />
            <Text variant="headlineSmall" style={styles.name}>
              {user?.full_name || 'User'}
            </Text>
            <Text variant="bodyMedium" style={styles.email}>
              {user?.email}
            </Text>
          </Card.Content>
        </Card>

        <Card style={[styles.menuCard, styles.glassCard]}>
          <Card.Content>
            <Button
              mode="outlined"
              onPress={() => router.push('/settings')}
              style={styles.menuButton}
              icon="cog"
            >
              Settings
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push('/interests')}
              style={styles.menuButton}
              icon="heart"
            >
              Manage Interests
            </Button>
          </Card.Content>
        </Card>

        <Card style={[styles.menuCard, styles.glassCard]}>
          <Card.Content>
            <Button
              mode="contained"
              onPress={handleSignOut}
              style={[styles.menuButton, { backgroundColor: theme.colors.error }]}
              icon="logout"
            >
              Sign Out
            </Button>
          </Card.Content>
        </Card>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileContent: {
    alignItems: 'center',
    padding: 24,
  },
  avatar: {
    marginBottom: 16,
  },
  name: {
    marginBottom: 8,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  email: {
    textAlign: 'center',
    color: 'rgba(237,233,254,0.8)',
  },
  menuCard: {
    marginBottom: 16,
  },
  menuButton: {
    marginBottom: 8,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 52,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
});
