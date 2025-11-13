import React from 'react';
import { View, StyleSheet, Modal, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface NetworkingIntroModalProps {
  visible: boolean;
  onDismiss: () => void;
  onGetStarted: () => void;
}

export default function NetworkingIntroModal({
  visible,
  onDismiss,
  onGetStarted,
}: NetworkingIntroModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["#160427", "#2B0B5E", "#4C1D95"]}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.emoji}>🤝</Text>
                <Text variant="headlineMedium" style={styles.title}>
                  AI Networking
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                  Your conversations reveal how you think
                </Text>
              </View>

              {/* How it works */}
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  How it works
                </Text>
                
                <View style={styles.stepCard}>
                  <Text style={styles.stepNumber}>1</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Have conversations</Text>
                    <Text style={styles.stepText}>
                      Every chat helps us understand your thinking style, interests, and communication patterns
                    </Text>
                  </View>
                </View>

                <View style={styles.stepCard}>
                  <Text style={styles.stepNumber}>2</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>We find your matches</Text>
                    <Text style={styles.stepText}>
                      Our AI analyzes compatibility and matches you with people whose thinking complements yours
                    </Text>
                  </View>
                </View>

                <View style={styles.stepCard}>
                  <Text style={styles.stepNumber}>3</Text>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Connect meaningfully</Text>
                    <Text style={styles.stepText}>
                      Start conversations with people who share your curiosity and add new perspectives
                    </Text>
                  </View>
                </View>
              </View>

              {/* Example matches */}
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Example matches
                </Text>
                
                <View style={styles.exampleCard}>
                  <Text style={styles.exampleEmoji}>💭</Text>
                  <Text style={styles.exampleText}>
                    <Text style={styles.exampleBold}>You ask deep questions</Text> → Match with someone who gives thoughtful answers
                  </Text>
                </View>

                <View style={styles.exampleCard}>
                  <Text style={styles.exampleEmoji}>🔍</Text>
                  <Text style={styles.exampleText}>
                    <Text style={styles.exampleBold}>You explore new ideas</Text> → Match with someone who loves learning
                  </Text>
                </View>

                <View style={styles.exampleCard}>
                  <Text style={styles.exampleEmoji}>⚡</Text>
                  <Text style={styles.exampleText}>
                    <Text style={styles.exampleBold}>You love debates</Text> → Match with someone who challenges views respectfully
                  </Text>
                </View>
              </View>

              {/* Privacy note */}
              <View style={styles.privacyNote}>
                <Text style={styles.privacyIcon}>🔒</Text>
                <Text style={styles.privacyText}>
                  Your conversations are private. We only analyze patterns to find compatible matches, not content.
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={onGetStarted}
                style={styles.primaryButton}
                labelStyle={styles.buttonLabel}
              >
                Get Started
              </Button>
              <Button
                mode="text"
                onPress={onDismiss}
                labelStyle={styles.linkLabel}
              >
                Maybe later
              </Button>
            </View>
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
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepText: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  exampleEmoji: {
    fontSize: 20,
  },
  exampleText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  exampleBold: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  privacyIcon: {
    fontSize: 20,
  },
  privacyText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    paddingTop: 20,
    gap: 12,
  },
  primaryButton: {
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
});
