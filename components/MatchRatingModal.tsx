import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface MatchRatingModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (rating: 'good' | 'bad', feedback?: string) => void;
  matchName: string;
}

export default function MatchRatingModal({
  visible,
  onDismiss,
  onSubmit,
  matchName,
}: MatchRatingModalProps) {
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRatingSelect = (selectedRating: 'good' | 'bad') => {
    setRating(selectedRating);
    setShowFeedback(true);
  };

  const handleSubmit = () => {
    if (rating) {
      onSubmit(rating, feedback.trim() || undefined);
      // Reset state
      setRating(null);
      setFeedback('');
      setShowFeedback(false);
    }
  };

  const handleSkip = () => {
    setRating(null);
    setFeedback('');
    setShowFeedback(false);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["#160427", "#2B0B5E", "#4C1D95"]}
            style={styles.modalContent}
          >
            <Text variant="headlineSmall" style={styles.title}>
              How was talking with {matchName}?
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Your feedback helps us find better matches for you
            </Text>

            {!showFeedback ? (
              <View style={styles.ratingButtons}>
                <TouchableOpacity
                  style={[
                    styles.ratingButton,
                    styles.goodButton,
                    rating === 'good' && styles.selectedButton,
                  ]}
                  onPress={() => handleRatingSelect('good')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingEmoji}>👍</Text>
                  <Text style={styles.ratingText}>Great match!</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.ratingButton,
                    styles.badButton,
                    rating === 'bad' && styles.selectedButton,
                  ]}
                  onPress={() => handleRatingSelect('bad')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingEmoji}>👎</Text>
                  <Text style={styles.ratingText}>Not a fit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.feedbackSection}>
                <Text variant="titleSmall" style={styles.feedbackTitle}>
                  {rating === 'good'
                    ? 'What made it great? (optional)'
                    : 'What was off? (optional)'}
                </Text>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder={
                    rating === 'good'
                      ? 'e.g., Great conversation, similar interests, thought-provoking'
                      : 'e.g., Different communication style, not much in common'
                  }
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.feedbackInput}
                  outlineColor="rgba(255,255,255,0.2)"
                  activeOutlineColor="#7C3AED"
                  textColor="#FFFFFF"
                />

                <View style={styles.actions}>
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    style={styles.submitButton}
                    labelStyle={styles.buttonLabel}
                  >
                    Submit Feedback
                  </Button>
                  <Button
                    mode="text"
                    onPress={handleSubmit}
                    labelStyle={styles.linkLabel}
                  >
                    Skip feedback
                  </Button>
                </View>
              </View>
            )}

            {!showFeedback && (
              <Button
                mode="text"
                onPress={handleSkip}
                style={styles.skipButton}
                labelStyle={styles.linkLabel}
              >
                Skip for now
              </Button>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 32,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
  },
  goodButton: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  badButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  selectedButton: {
    borderWidth: 3,
  },
  ratingEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackSection: {
    marginBottom: 16,
  },
  feedbackTitle: {
    color: '#FFFFFF',
    marginBottom: 12,
  },
  feedbackInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  actions: {
    gap: 12,
  },
  submitButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkLabel: {
    color: 'rgba(255,255,255,0.7)',
  },
  skipButton: {
    marginTop: 8,
  },
});
