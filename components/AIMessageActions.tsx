import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';

interface AIMessageActionsProps {
  onExplainSimpler: () => void;
  onWhatElse: () => void;
  onChallenge: () => void;
}

export default function AIMessageActions({
  onExplainSimpler,
  onWhatElse,
  onChallenge,
}: AIMessageActionsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onExplainSimpler}
        activeOpacity={0.7}
      >
        <Text style={styles.actionIcon}>🤔</Text>
        <Text style={styles.actionText}>Explain simpler</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onWhatElse}
        activeOpacity={0.7}
      >
        <Text style={styles.actionIcon}>💭</Text>
        <Text style={styles.actionText}>What else?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onChallenge}
        activeOpacity={0.7}
      >
        <Text style={styles.actionIcon}>🎯</Text>
        <Text style={styles.actionText}>Challenge that</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
