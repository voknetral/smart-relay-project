import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MqttProvider } from '@/contexts/MqttContext';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#E8EBF2');
      NavigationBar.setButtonStyleAsync('dark');
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LanguageProvider>
        <MqttProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: false,
                animation: 'fade'
              }}
            />
          </Stack>
        </MqttProvider>
      </LanguageProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
