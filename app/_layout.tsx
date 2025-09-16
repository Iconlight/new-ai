import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider } from '../src/contexts/AuthContext';
import { ChatProvider } from '../src/contexts/ChatContext';
import { NotificationProvider } from '../src/contexts/NotificationContext';
import { lightTheme, darkTheme } from '../src/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <PaperProvider theme={isDark ? darkTheme : lightTheme}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <ChatProvider>
            <NotificationProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" />
              </Stack>
              <StatusBar style={isDark ? 'light' : 'dark'} />
            </NotificationProvider>
          </ChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
