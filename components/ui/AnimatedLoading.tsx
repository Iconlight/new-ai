import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface AnimatedLoadingProps {
  message?: string;
  size?: number;
  transparentBackground?: boolean;
}

export default function AnimatedLoading({ 
  message = "Loading...", 
  size = 120,
  transparentBackground = false,
}: AnimatedLoadingProps) {
  const theme = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Create a breathing/pulsing effect (no rotation)
    const breathingAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    breathingAnimation.start();
    return () => {
      breathingAnimation.stop();
    };
  }, [opacityAnim, scaleAnim]);

  // No rotation

  return (
    <View style={[styles.container, { backgroundColor: transparentBackground ? 'transparent' : theme.colors.background }]}>
      <View style={styles.iconContainer}>
        {/* Outer glow effect */}
        <Animated.View
          style={[
            styles.glowContainer,
            {
              opacity: opacityAnim.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0.1, 0.3],
              }),
              transform: [
                { 
                  scale: scaleAnim.interpolate({
                    inputRange: [0.95, 1.05],
                    outputRange: [1.2, 1.4],
                  })
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.glow,
              {
                width: size * 1.5,
                height: size * 1.5,
                borderRadius: (size * 1.5) / 2,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </Animated.View>

        {/* Main icon with animation */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Image
            source={require('../../assets/images/loading.png')}
            style={[
              styles.icon,
              {
                width: size,
                height: size,
              },
            ]}
            contentFit="contain"
          />
        </Animated.View>

        {/* Inner highlight effect */}
        <Animated.View
          style={[
            styles.highlightContainer,
            {
              opacity: opacityAnim.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0, 0.6],
              }),
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.highlight,
              {
                width: size * 0.6,
                height: size * 0.6,
                borderRadius: (size * 0.6) / 2,
                backgroundColor: theme.colors.surface,
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Loading text with fade animation */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: opacityAnim.interpolate({
              inputRange: [0.3, 1],
              outputRange: [0.5, 1],
            }),
          },
        ]}
      >
        <Text
          variant="titleMedium"
          style={[
            styles.loadingText,
            { color: theme.colors.onBackground }
          ]}
        >
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  glowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    opacity: 0.3,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  icon: {
    borderRadius: 20,
  },
  highlightContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  highlight: {
    opacity: 0.4,
  },
  textContainer: {
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
