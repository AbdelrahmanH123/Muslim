import { Link, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { C } from '../../components/ui';
import { useStore } from '../../lib/store';

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>
);

export default function TabsLayout() {
  const { t } = useStore();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: '#fff' },
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable style={{ paddingHorizontal: 16 }} accessibilityLabel={t('settings')}>
              <Text style={{ color: '#fff', fontSize: 20 }}>⚙︎</Text>
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabSearch'), tabBarIcon: icon('🔍') }} />
      <Tabs.Screen name="topics" options={{ title: t('tabTopics'), tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="ask" options={{ title: t('tabAsk'), tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="verify" options={{ title: t('tabVerify'), tabBarIcon: icon('✅') }} />
      <Tabs.Screen name="favorites" options={{ title: t('tabFavorites'), tabBarIcon: icon('⭐') }} />
    </Tabs>
  );
}
