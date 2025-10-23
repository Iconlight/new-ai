import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

interface NetworkingProgressProps {
  conversationCount: number;
  requiredConversations?: number;
}

export default function NetworkingProgress({
  conversationCount,
  requiredConversations = 3,
}: NetworkingProgressProps) {
  const progress = Math.min(conversationCount / requiredConversations, 1);
  const remaining = Math.max(requiredConversations - conversationCount, 0);
  
  const isUnlocked = conversationCount >= requiredConversations;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall" style={styles.title}>
          {isUnlocked ? '✨ Matches Unlocked!' : '🔓 Unlock Matches'}
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          {isUnlocked
            ? 'You can now see your compatible matches'
            : `Have ${remaining} more ${remaining === 1 ? 'conversation' : 'conversations'} to unlock matches`}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {conversationCount} / {requiredConversations}
        </Text>
      </View>

      {!isUnlocked && (
        <View style={styles.milestonesContainer}>
          {[...Array(requiredConversations)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.milestone,
                index < conversationCount && styles.milestoneCompleted,
              ]}
            >
              <Text style={styles.milestoneIcon}>
                {index < conversationCount ? '✓' : (index + 1)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  milestonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  milestone: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneCompleted: {
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderColor: '#7C3AED',
  },
  milestoneIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
