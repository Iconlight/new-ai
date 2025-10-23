import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ConversationOutcome, generateConversationInsights, trackInsightAction, findRelatedTopics } from '../src/services/conversationInsights';
import { router } from 'expo-router';

interface ConversationOutcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
  chatId: string;
  userId: string;
  chatTitle: string;
}

export default function ConversationOutcomeModal({
  visible,
  onDismiss,
  chatId,
  userId,
  chatTitle,
}: ConversationOutcomeModalProps) {
  const [insights, setInsights] = useState<ConversationOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTopics, setRelatedTopics] = useState<any[]>([]);

  useEffect(() => {
    if (visible) {
      loadInsights();
    }
  }, [visible]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const outcome = await generateConversationInsights(chatId, userId);
      setInsights(outcome);

      // Load related topics
      if (outcome?.keyTopics) {
        const related = await findRelatedTopics(outcome.keyTopics, userId);
        setRelatedTopics(related);
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!insights) return;

    const message = `💡 Key takeaways from my conversation:\n\n${insights.insights.map((i, idx) => `${idx + 1}. ${i.takeaway}`).join('\n')}\n\nDiscovered on ProactiveAI`;

    try {
      await Share.share({
        message,
      });
      await trackInsightAction(userId, chatId, 'shared');
    } catch (error) {
      console.error('Error sharing insights:', error);
    }
  };

  const handleFindRelated = () => {
    trackInsightAction(userId, chatId, 'found_related');
    onDismiss();
    // Navigate to discover with filters
    router.push('/discover');
  };

  const handleContinueInNetworking = () => {
    trackInsightAction(userId, chatId, 'continued_networking');
    onDismiss();
    router.push('/networking');
  };

  const handleDismiss = () => {
    trackInsightAction(userId, chatId, 'dismissed');
    onDismiss();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["#160427", "#2B0B5E", "#4C1D95"]}
            style={styles.modalContent}
          >
            <View style={styles.header}>
              <Text variant="headlineSmall" style={styles.title}>
                Conversation Summary
              </Text>
              <IconButton
                icon="close"
                size={24}
                iconColor="#FFFFFF"
                onPress={handleDismiss}
                style={styles.closeButton}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.loadingText}>
                  Generating insights from your conversation...
                </Text>
              </View>
            ) : insights ? (
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Key Takeaways */}
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    ✨ Key Takeaways
                  </Text>
                  {insights.insights.map((insight, index) => (
                    <View key={index} style={styles.insightCard}>
                      <View style={styles.insightHeader}>
                        <Text style={styles.insightEmoji}>
                          {insight.category === 'fact' ? '📊' :
                           insight.category === 'opinion' ? '💭' :
                           insight.category === 'question' ? '❓' : '💡'}
                        </Text>
                        <Text style={styles.insightCategory}>{insight.category}</Text>
                      </View>
                      <Text style={styles.insightText}>{insight.takeaway}</Text>
                    </View>
                  ))}
                </View>

                {/* Topics Discussed */}
                {insights.keyTopics.length > 0 && (
                  <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      📚 Topics Explored
                    </Text>
                    <View style={styles.topicsContainer}>
                      {insights.keyTopics.map((topic, index) => (
                        <View key={index} style={styles.topicChip}>
                          <Text style={styles.topicText}>{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Conversation Style */}
                <View style={styles.section}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    🎯 Your Style
                  </Text>
                  <View style={styles.styleCard}>
                    <Text style={styles.styleEmoji}>
                      {insights.conversationStyle === 'exploratory' ? '🔍' :
                       insights.conversationStyle === 'analytical' ? '📊' :
                       insights.conversationStyle === 'creative' ? '🎨' : '🤔'}
                    </Text>
                    <Text style={styles.styleText}>
                      {insights.conversationStyle.charAt(0).toUpperCase() + insights.conversationStyle.slice(1)}
                    </Text>
                    <View style={styles.depthIndicator}>
                      {[...Array(5)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.depthDot,
                            i < insights.depth && styles.depthDotActive
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsSection}>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    What's Next?
                  </Text>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleShare}
                  >
                    <Text style={styles.actionIcon}>↗️</Text>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>Share These Insights</Text>
                      <Text style={styles.actionSubtitle}>
                        Let others know what you learned
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {relatedTopics.length > 0 && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleFindRelated}
                    >
                      <Text style={styles.actionIcon}>🔗</Text>
                      <View style={styles.actionTextContainer}>
                        <Text style={styles.actionTitle}>Explore Related Topics</Text>
                        <Text style={styles.actionSubtitle}>
                          {relatedTopics.length} similar conversations waiting
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleContinueInNetworking}
                  >
                    <Text style={styles.actionIcon}>🤝</Text>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionTitle}>Discuss with Others</Text>
                      <Text style={styles.actionSubtitle}>
                        Find people interested in these topics
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  Unable to generate insights. Try again later.
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              <Button
                mode="contained"
                onPress={handleDismiss}
                style={styles.doneButton}
                labelStyle={styles.doneButtonLabel}
              >
                Done
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  closeButton: {
    margin: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightEmoji: {
    fontSize: 20,
  },
  insightCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  insightText: {
    color: '#FFFFFF',
    lineHeight: 22,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicChip: {
    backgroundColor: 'rgba(124,58,237,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  topicText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  styleCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  styleEmoji: {
    fontSize: 32,
  },
  styleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  depthIndicator: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  depthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  depthDotActive: {
    backgroundColor: '#7C3AED',
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  footer: {
    paddingTop: 16,
  },
  doneButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
  },
  doneButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
