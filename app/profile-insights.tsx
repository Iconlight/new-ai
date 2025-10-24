import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, useTheme, List } from 'react-native-paper';
import { router } from 'expo-router';
import { getPersonalInsights, PersonalInsights } from '../src/services/userInsights';
import { useAuth } from '../src/contexts/AuthContext';

export default function ProfileInsightsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [insights, setInsights] = useState<PersonalInsights | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      const data = await getPersonalInsights(user.id);
      if (mounted) setInsights(data);
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const short = (s: string) => {
    const [y, m] = s.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return d.toLocaleString(undefined, { month: 'short' });
  };

  const vals = insights?.networkGrowth?.map(g => g.count) || [0];
  const max = Math.max(1, ...vals);

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBg}
    >
      <View style={[styles.container, { backgroundColor: 'transparent' }]}> 
        <View style={styles.floatingHeader}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitleText}>Insights</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content}>
          <Card style={[styles.card, styles.cardElevated]}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.sectionTitle}>Network Growth</Text>
              <View style={styles.barChartTall}>
                {(insights?.networkGrowth || []).map((g, idx) => (
                  <View key={idx} style={styles.barWrap}>
                    <View style={[styles.barTall, { height: 16 + Math.round((g.count / max) * 120) }]} />
                    <Text style={styles.barLabel}>{short(g.month)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legendRow}>
                <List.Icon icon="chart-bar" color="#C4B5FD" />
                <Text style={styles.legendText}>Contacts added per month</Text>
              </View>
            </Card.Content>
          </Card>

          <Card style={[styles.card, styles.cardElevated]}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.sectionTitle}>Details</Text>
              <List.Item
                title={insights?.conversationStyle || '—'}
                description="Conversation style"
                left={(p) => <List.Icon {...p} icon="account-tie" />}
              />
              <List.Item
                title={insights?.topTopics?.map(t => `${t.name} (${t.count})`).join(', ') || '—'}
                description="Top topics"
                left={(p) => <List.Icon {...p} icon="tag" />}
              />
              <List.Item
                title={`${insights?.questionCount || 0} / ${insights?.answerCount || 0}`}
                description="Q/A count"
                left={(p) => <List.Icon {...p} icon="help-circle" />}
              />
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientBg: { flex: 1 },
  content: { flex: 1, padding: 16 },
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
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  card: { marginBottom: 16 },
  cardElevated: {
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderWidth: 0,
    borderRadius: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  barChartTall: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    marginTop: 8,
    marginBottom: 10,
  },
  barWrap: {
    alignItems: 'center',
    marginRight: 12,
  },
  barTall: {
    width: 18,
    backgroundColor: '#A78BFA',
    borderRadius: 8,
  },
  barLabel: {
    color: 'rgba(237,233,254,0.8)',
    fontSize: 11,
    marginTop: 8,
    transform: [{ rotate: '-28deg' }],
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { color: 'rgba(237,233,254,0.9)' },
});
