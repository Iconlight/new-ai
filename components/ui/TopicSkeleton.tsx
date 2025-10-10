import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface TopicSkeletonProps {
  isRight?: boolean;
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
    <View style={[styles.bubbleRow, isRight ? styles.rowRight : styles.rowLeft]}>
      <Animated.View
        style={[
          styles.bubble,
          isRight ? styles.bubbleRight : styles.bubbleLeft,
          { opacity },
        ]}
      >
        {/* Title skeleton */}
        <View style={[styles.skeletonLine, styles.titleLine]} />
        
        {/* Message skeleton - 2 lines */}
        <View style={[styles.skeletonLine, styles.messageLine, { marginTop: 8 }]} />
        <View style={[styles.skeletonLine, styles.messageLine, { width: '70%', marginTop: 4 }]} />
        
        {/* Meta skeleton */}
        <View style={[styles.metaRow, { marginTop: 12 }]}>
          <View style={[styles.skeletonLine, styles.metaLine]} />
          <View style={[styles.skeletonLine, styles.metaLine]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    width: '85%',
    minWidth: '85%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  bubbleLeft: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bubbleRight: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  titleLine: {
    width: '60%',
    height: 16,
  },
  messageLine: {
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLine: {
    width: '35%',
    height: 10,
  },
});
