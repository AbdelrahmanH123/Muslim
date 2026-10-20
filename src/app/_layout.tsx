import { Amiri_400Regular, useFonts } from '@expo-google-fonts/amiri';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { C, Loading } from '../components/ui';
import { StoreProvider, useStore } from '../lib/store';

function Root() {
  const { ready, lang, t } = useStore();
  const [fontsLoaded] = useFonts({ Amiri_400Regular });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.title = t('appName');
    }
  }, [lang, t]);

  if (!ready || !fontsLoaded) return <Loading />;
  return (
    <View style={{ flex: 1, direction: lang === 'ar' ? 'rtl' : 'ltr', backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: t('settings') }} />
        <Stack.Screen name="quran/[surah]" options={{ title: t('quran') }} />
        <Stack.Screen name="hadith/[col]/[num]" options={{ title: t('hadith') }} />
        <Stack.Screen name="hisn/[id]" options={{ title: t('hisn') }} />
        <Stack.Screen name="topic/[id]" options={{ title: t('tabTopics') }} />
        <Stack.Screen name="topics" options={{ title: t('tabTopics') }} />
        <Stack.Screen name="prayer" options={{ title: t('prayerTimes') }} />
        <Stack.Screen name="adhkar" options={{ title: t('adhkar') }} />
        <Stack.Screen name="tasbih" options={{ title: t('tasbih') }} />
      </Stack>
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <StoreProvider>
          <Root />
        </StoreProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
