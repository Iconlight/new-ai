import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Appbar, useTheme, Avatar } from 'react-native-paper';
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Profile" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.profileCard}>
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

        <Card style={styles.menuCard}>
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
            <Button
              mode="outlined"
              onPress={() => router.push('/notifications')}
              style={styles.menuButton}
              icon="bell"
            >
              Notifications
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.menuCard}>
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
  );
}

const styles = StyleSheet.create({
  container: {
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
  },
  email: {
    opacity: 0.7,
    textAlign: 'center',
  },
  menuCard: {
    marginBottom: 16,
  },
  menuButton: {
    marginBottom: 8,
  },
});
