import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { ProactiveTopic } from '../src/types';

interface TopicCardProps {
  topic: ProactiveTopic;
  onPress: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  isLiked: boolean;
  isSaved: boolean;
  disabled?: boolean;
  formatMessage: (message: string) => string;
}

export default function TopicCard({
  topic,
  onPress,
  onLike,
  onSave,
  onShare,
  isLiked,
  isSaved,
  disabled,
  formatMessage,
}: TopicCardProps) {

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      style={styles.card}
    >
      <Text variant="titleSmall" style={styles.cardTitle}>
        {topic.topic}
      </Text>
      <Text variant="bodyMedium" style={styles.cardMessage}>
        {formatMessage(topic.message)}
      </Text>
      
      {/* Meta row */}
      <View style={styles.cardMeta}>
        <Text variant="bodySmall" style={styles.metaText}>
          {new Date(topic.scheduled_for).toLocaleTimeString()}
        </Text>
        {topic.interests.length > 0 && (
          <Text variant="bodySmall" style={styles.metaText}>
            {topic.interests.slice(0, 2).join(', ')}
            {topic.interests.length > 2 && ` +${topic.interests.length - 2}`}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onLike();
          }}
          style={styles.actionButton}
        >
          <IconButton
            icon={isLiked ? 'heart' : 'heart-outline'}
            size={20}
            iconColor={isLiked ? '#EF4444' : 'rgba(255,255,255,0.7)'}
            style={styles.actionIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
          style={styles.actionButton}
        >
          <IconButton
            icon={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            iconColor={isSaved ? '#7C3AED' : 'rgba(255,255,255,0.7)'}
            style={styles.actionIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onShare();
          }}
          style={styles.actionButton}
        >
          <IconButton
            icon="share-variant-outline"
            size={20}
            iconColor="rgba(255,255,255,0.7)"
            style={styles.actionIcon}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: 16,
  },
  cardMessage: {
    lineHeight: 22,
    marginBottom: 12,
    color: '#EDE9FE',
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  metaText: {
    color: 'rgba(237,233,254,0.8)',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 4,
    marginLeft: -8,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
