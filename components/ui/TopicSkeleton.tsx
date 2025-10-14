import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface TopicSkeletonProps {
  isRight?: boolean; // Kept for backwards compatibility but not used
}

export default function TopicSkeleton({ isRight = false }: TopicSkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity },
      ]}
    >
      {/* Title skeleton */}
      <View style={[styles.skeletonLine, styles.titleLine]} />
      
      {/* Message skeleton - 2 lines */}
      <View style={[styles.skeletonLine, styles.messageLine, { marginTop: 10 }]} />
      <View style={[styles.skeletonLine, styles.messageLine, { width: '70%', marginTop: 6 }]} />
      
      {/* Meta skeleton */}
      <View style={[styles.metaRow, { marginTop: 14 }]}>
        <View style={[styles.skeletonLine, styles.metaLine]} />
        <View style={[styles.skeletonLine, styles.metaLine]} />
      </View>
    </Animated.View>
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
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  titleLine: {
    width: '50%',
    height: 18,
  },
  messageLine: {
    width: '100%',
    height: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLine: {
    width: '30%',
    height: 10,
  },
});
