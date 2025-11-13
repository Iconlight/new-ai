import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Button, useTheme, Avatar, List, ProgressBar } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { getPersonalInsights, PersonalInsights } from '../src/services/userInsights';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [insights, setInsights] = useState<PersonalInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      setInsightsLoading(true);
      try {
        const data = await getPersonalInsights(user.id);
        if (mounted) setInsights(data);
      } catch {
        if (mounted) setInsights(null);
      } finally {
        if (mounted) setInsightsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const insightsRef = useRef<View>(null);

  const handleShareInsights = async () => {
    if (!insights) return;
    const qaTotal = insights.questionCount + insights.answerCount;
    const ratio = qaTotal > 0 ? Math.round((insights.questionCount / qaTotal) * 100) : 0;
    const top = insights.topTopics.map(t => `${t.name} (${t.count})`).join(', ');
    const growth = insights.networkGrowth.map(g => `${g.month}: ${g.count}`).join(' | ');
    const text = `Your ProactiveAI: ${insights.summary}\nStyle: ${insights.conversationStyle}\nTop topics: ${top || '—'}\nQ/A: ${insights.questionCount}/${insights.answerCount} (${ratio}%)\nCompatible: ${insights.compatibleStyles.join(', ') || '—'}\nNetwork: ${growth || '—'}`;
    try {
      await Share.share({ message: text });
    } catch {}
  };

  const handleShareInsightsImage = async () => {
    if (!insights) return;
    try {
      // Try to capture the insights card as an image (falls back to text share if unavailable)
      const { captureRef } = await import('react-native-view-shot');
      const uri = await captureRef(insightsRef.current as any, { format: 'png', quality: 1, result: 'tmpfile' } as any);
      await Share.share({ url: uri, message: 'My ProactiveAI insights' });
    } catch (e) {
      await handleShareInsights();
    }
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

        <Card style={[styles.menuCard, styles.cardElevated]}>
          <Card.Content>
            <View ref={insightsRef}>
            <Text variant="titleLarge" style={styles.sectionTitle}>Personal Insights</Text>
            {insightsLoading ? (
              <Text style={styles.noData}>Loading insights…</Text>
            ) : insights ? (
              <>
                <View style={styles.grid}>
                  <Animated.View entering={FadeInDown.duration(500).delay(40).springify().damping(14)} style={[styles.dataCard, styles.gradientSoft]}>
                    <View style={styles.rowBetween}>
                      <List.Icon icon="account-tie" color="#E9D5FF" />
                      <Text style={styles.cardLabel}>Style</Text>
                    </View>
                    <Text style={styles.metricValue}>{insights.conversationStyle}</Text>
                    <Text style={styles.cardSubtle}>{insights.compatibleStyles.join(', ') || '—'}</Text>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.duration(500).delay(120).springify().damping(14)} style={[styles.dataCard, styles.gradientSoft]}>
                    <View style={styles.rowBetween}>
                      <List.Icon icon="help-circle" color="#E9D5FF" />
                      <Text style={styles.cardLabel}>Q/A</Text>
                    </View>
                    {(() => {
                      const total = insights.questionCount + insights.answerCount;
                      const pct = total > 0 ? insights.questionCount / total : 0;
                      return (
                        <View style={{ width: '100%' }}>
                          <Text style={styles.metricValue}>{Math.round(pct * 100)}%</Text>
                          <ProgressBar progress={pct} color="#A78BFA" style={styles.progress} />
                          <Text style={styles.cardSubtle}>{insights.questionCount} questions • {insights.answerCount} answers</Text>
                        </View>
                      );
                    })()}
                  </Animated.View>

                  <Animated.View entering={FadeInDown.duration(500).delay(200).springify().damping(14)} style={[styles.dataCard, styles.gradientSoft]}>
                    <View style={styles.rowBetween}>
                      <List.Icon icon="tag" color="#E9D5FF" />
                      <Text style={styles.cardLabel}>Top Topics</Text>
                    </View>
                    <View style={styles.chipsWrap}>
                      {insights.topTopics.slice(0,3).map((t, i) => (
                        <View key={i} style={styles.chip}><Text style={styles.chipText}>{t.name}</Text></View>
                      ))}
                      {insights.topTopics.length === 0 && (
                        <Text style={styles.cardSubtle}>—</Text>
                      )}
                    </View>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.duration(500).delay(280).springify().damping(14)} style={[styles.dataCard, styles.gradientSoft]}>
                    <View style={styles.rowBetween}>
                      <List.Icon icon="message-text" color="#E9D5FF" />
                      <Text style={styles.cardLabel}>Meaningful</Text>
                    </View>
                    <Text style={styles.bigNumber}>{insights.meaningfulThisMonth}</Text>
                    <Text style={styles.cardSubtle}>this month</Text>
                  </Animated.View>

                  <Animated.View entering={FadeInDown.duration(500).delay(360).springify().damping(14)} style={[styles.dataCardWide, styles.gradientSoft]}>
                    <Pressable onPress={() => router.push('/profile-insights')}>
                      <View style={styles.rowBetween}>
                        <List.Icon icon="chart-line" color="#E9D5FF" />
                        <Text style={styles.cardLabel}>Network Growth</Text>
                      </View>
                      {(() => {
                        const vals = insights.networkGrowth.map(g => g.count);
                        const max = Math.max(1, ...vals);
                        const short = (s: string) => {
                          const [y, m] = s.split('-').map(Number);
                          const d = new Date(y, (m || 1) - 1, 1);
                          return d.toLocaleString(undefined, { month: 'short' });
                        };
                        return (
                          <>
                            <View style={styles.barChart}>
                              {insights.networkGrowth.map((g, idx) => (
                                <View key={idx} style={styles.barWrap}>
                                  <View style={[styles.bar, { height: 12 + Math.round((g.count / max) * 44) }]} />
                                  <Text style={styles.barLabel}>{short(g.month)}</Text>
                                </View>
                              ))}
                            </View>
                          </>
                        );
                      })()}
                    </Pressable>
                  </Animated.View>
                </View>

                
              </>
            ) : (
              <Text style={styles.noData}>No insights yet</Text>
            )}
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.menuCard, styles.glassCard]}>
          <Card.Content>
            <Button
              mode="outlined"
              onPress={() => router.push('/settings')}
              textColor="#FFFFFF"
              style={[styles.menuButton, styles.outlinedWhiteButton]}
              icon="cog"
            >
              Settings
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push('/interests')}
              textColor="#FFFFFF"
              style={[styles.menuButton, styles.outlinedWhiteButton]}
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
              textColor="#FFFFFF"
              style={[styles.menuButton, { backgroundColor: '#EF4444' }]}
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0,
    borderRadius: 16,
  },
  cardElevated: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 0,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  noData: {
    color: 'rgba(237,233,254,0.8)',
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataCard: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  dataCardWide: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gradientSoft: {
    backgroundColor: 'rgba(131, 92, 246, 0.1)',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardLabel: {
    color: 'rgba(237,233,254,0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: '#F5F3FF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  cardSubtle: {
    color: 'rgba(237,233,254,0.75)',
    fontSize: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bigNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    marginTop: 8,
    marginBottom: 6,
  },
  barWrap: {
    alignItems: 'center',
    marginRight: 10,
  },
  bar: {
    width: 12,
    backgroundColor: '#A78BFA',
    borderRadius: 6,
    marginRight: 0,
  },
  barLabel: {
    color: 'rgba(237,233,254,0.8)',
    fontSize: 10,
    marginTop: 6,
    transform: [{ rotate: '-28deg' }],
  },
  progress: {
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareButton: {
    marginTop: 8,
  },
  outlinedWhiteButton: {
    borderColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
  },
});
