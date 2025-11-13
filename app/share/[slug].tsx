import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Linking, Platform } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchSharedLink } from '../../src/services/shareLinks';
import { useChat } from '../../src/contexts/ChatContext';

export default function SharePreviewScreen() {
  const { slug, auto } = useLocalSearchParams<{ slug: string; auto?: string }>();
  const { startChatWithAI } = useChat();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!slug) return;
      const res = await fetchSharedLink(String(slug));
      if (mounted) {
        setData(res);
        setLoading(false);
        // If deep link requested auto, immediately start chat
        if (res && (auto === '1' || auto === 'true')) {
          // Delay a tick to allow UI to settle
          setTimeout(() => {
            handleStartChat();
          }, 50);
        }
      }
    })();
    return () => { mounted = false; };
  }, [slug, auto]);

  const handleStartChat = async () => {
    if (!data) return;
    const title = data.title || 'Shared Topic';
    const description = data.description || 'Discuss this topic';
    const newsContext = data.news_context || {
      title: data.title,
      description: data.description,
      url: data.source_url,
      category: data.category,
      content: data.news_context?.content,
    };
    const chat = await startChatWithAI(description, title, newsContext);
    if (chat) {
      router.replace({ pathname: '/(tabs)/chat/[id]', params: { id: chat.id, opening: '1' } });
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={["#160427", "#2B0B5E", "#4C1D95"]} style={styles.container}>
        <ActivityIndicator color="#fff" />
      </LinearGradient>
    );
  }

  if (!data) {
    return (
      <LinearGradient colors={["#160427", "#2B0B5E", "#4C1D95"]} style={styles.container}>
        <Text style={styles.title}>Link not found</Text>
        <Button mode="contained" onPress={() => router.back()}>Go back</Button>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#160427", "#2B0B5E", "#4C1D95"]} style={styles.container}>
      <View style={styles.card}>
        {data.image_url ? (
          <Image source={{ uri: data.image_url }} style={styles.image} resizeMode="cover" />
        ) : null}
        <Text variant="titleLarge" style={styles.title}>{data.title || 'Shared Topic'}</Text>
        {data.description ? (
          <Text variant="bodyMedium" style={styles.desc}>{data.description}</Text>
        ) : null}
        {data.source_url ? (
          <Button
            mode="text"
            onPress={() => Linking.openURL(data.source_url)}
            textColor="#C4B5FD"
          >View Original Source</Button>
        ) : null}
        <Button mode="contained" onPress={handleStartChat} style={{ marginTop: 8 }}>
          Start Conversation
        </Button>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '92%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  image: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  title: { color: '#fff', marginBottom: 8 },
  desc: { color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
});
