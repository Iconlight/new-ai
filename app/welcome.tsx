import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { analytics } from '../src/services/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    title: "AI finds conversations\nyou'll actually enjoy",
    description: "No more boring small talk. Get personalized topics that match your interests and spark real curiosity.",
    icon: "💬",
    color: "#7C3AED",
  },
  {
    title: "Match with people\nwho think like you",
    description: "Your conversations reveal how you think. We find people whose thinking complements yours perfectly.",
    icon: "🤝",
    color: "#EC4899",
  },
  {
    title: "Never run out of\nthings to talk about",
    description: "Fresh topics every day from real news, science, culture, and more. Always something interesting to explore.",
    icon: "✨",
    color: "#8B5CF6",
  },
];

export default function WelcomeScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSamples, setShowSamples] = useState(false);
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<any>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  React.useEffect(() => {
    analytics.track('screen_viewed', undefined, { screen: 'welcome_carousel' });
  }, []);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      analytics.track('screen_viewed', undefined, { screen: 'welcome_carousel', action: 'slide_next', from: currentIndex, to: nextIndex });
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      scrollViewRef.current?.scrollTo({
        x: prevIndex * SCREEN_WIDTH,
        animated: true,
      });
      analytics.track('screen_viewed', undefined, { screen: 'welcome_carousel', action: 'slide_prev', from: currentIndex, to: prevIndex });
    }
  };

  const handleTryWithoutSignup = () => {
    analytics.track('screen_viewed', undefined, { screen: 'welcome_samples', action: 'try_without_signup' });
    setShowSamples(true);
  };

  const handleSignUp = () => {
    analytics.track('screen_viewed', undefined, { screen: 'welcome', action: 'signup' });
    router.replace('/(auth)/sign-up');
  };

  const handleLogin = () => {
    analytics.track('screen_viewed', undefined, { screen: 'welcome', action: 'login' });
    router.replace('/(auth)/sign-in');
  };

  if (showSamples) {
    return (
      <LinearGradient
        colors={["#160427", "#2B0B5E", "#4C1D95"]}
        style={styles.container}
      >
        <View style={styles.samplesContainer}>
          <Text variant="headlineSmall" style={styles.samplesTitle}>
            Try a sample conversation
          </Text>
          <Text variant="bodyLarge" style={styles.samplesSubtitle}>
            Here's what a ProactiveAI topic looks like
          </Text>

          {/* Sample topics */}
          <View style={styles.sampleCards}>
            <TouchableOpacity
              style={styles.sampleCard}
              onPress={() => {
                analytics.track('screen_viewed', undefined, { screen: 'welcome_samples', action: 'topic_tapped', topic: 'technology' });
                // Show this is just a preview - redirect to signup for full experience
                handleSignUp();
              }}
            >
              <Text style={styles.sampleEmoji}>💻</Text>
              <Text variant="titleMedium" style={styles.sampleTitle}>
                technology
              </Text>
              <Text variant="bodyMedium" style={styles.sampleMessage}>
                AI is learning to predict natural disasters before they strike. How do you think this changes emergency response?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sampleCard}
              onPress={() => {
                analytics.track('screen_viewed', undefined, { screen: 'welcome_samples', action: 'topic_tapped', topic: 'psychology' });
                // Show this is just a preview - redirect to signup for full experience
                handleSignUp();
              }}
            >
              <Text style={styles.sampleEmoji}>🧠</Text>
              <Text variant="titleMedium" style={styles.sampleTitle}>
                psychology
              </Text>
              <Text variant="bodyMedium" style={styles.sampleMessage}>
                Studies show we make better decisions after a good night's sleep. What's your decision-making process?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sampleCard}
              onPress={() => {
                analytics.track('screen_viewed', undefined, { screen: 'welcome_samples', action: 'topic_tapped', topic: 'culture' });
                // Show this is just a preview - redirect to signup for full experience
                handleSignUp();
              }}
            >
              <Text style={styles.sampleEmoji}>🎨</Text>
              <Text variant="titleMedium" style={styles.sampleTitle}>
                culture
              </Text>
              <Text variant="bodyMedium" style={styles.sampleMessage}>
                Museums are using VR to recreate ancient civilizations. Would you prefer exploring history virtually or in person?
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sampleActions}>
            <Button
              mode="contained"
              onPress={handleSignUp}
              style={styles.signupButton}
              labelStyle={styles.buttonLabel}
            >
              Sign up to continue
            </Button>
            <Button
              mode="text"
              onPress={handleLogin}
              labelStyle={styles.linkLabel}
            >
              Already have an account? Log in
            </Button>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#160427", "#2B0B5E", "#4C1D95"]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text variant="headlineLarge" style={styles.logo}>
          ProactiveAI
        </Text>
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIndex);
        }}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={[styles.iconContainer, { backgroundColor: slide.color }]}>
              <Text style={styles.icon}>{slide.icon}</Text>
            </View>
            <Text variant="displaySmall" style={styles.title}>
              {slide.title}
            </Text>
            <Text variant="bodyLarge" style={styles.description}>
              {slide.description}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Navigation buttons */}
      <View style={styles.navigation}>
        {currentIndex > 0 && (
          <Button
            mode="text"
            onPress={handlePrevious}
            labelStyle={styles.navButton}
          >
            Back
          </Button>
        )}
        <View style={{ flex: 1 }} />
        {currentIndex < SLIDES.length - 1 ? (
          <Button
            mode="text"
            onPress={handleNext}
            labelStyle={styles.navButton}
          >
            Next
          </Button>
        ) : null}
      </View>

      {/* Bottom actions */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={handleSignUp}
          style={styles.primaryButton}
          labelStyle={styles.buttonLabel}
        >
          Get Started
        </Button>
        <Button
          mode="outlined"
          onPress={handleTryWithoutSignup}
          style={styles.secondaryButton}
          labelStyle={styles.buttonLabel}
        >
          Try without signing up
        </Button>
        <Button
          mode="text"
          onPress={handleLogin}
          labelStyle={styles.linkLabel}
        >
          Already have an account? Log in
        </Button>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logo: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 60,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '700',
    lineHeight: 40,
  },
  description: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 28,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  navButton: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 4,
  },
  secondaryButton: {
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingVertical: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  linkLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  // Samples screen
  samplesContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  samplesTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 8,
  },
  samplesSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 32,
  },
  sampleCards: {
    flex: 1,
    gap: 16,
  },
  sampleCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
  },
  sampleEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  sampleTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  sampleMessage: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  sampleActions: {
    paddingVertical: 24,
    gap: 12,
  },
  signupButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 4,
  },
});
