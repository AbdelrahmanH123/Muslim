import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { HitCard } from '../../components/HitCard';
import { C, Card, Row, Screen, T } from '../../components/ui';
import { ayahOfTheDay, hadithOfTheDay } from '../../lib/daily';
import { formatTime, prayerTimes } from '../../lib/prayer';
import type { Hit } from '../../lib/search';
import { useStore } from '../../lib/store';

function Tile({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        padding: 14,
        gap: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <T size={26}>{icon}</T>
      <T bold>{label}</T>
    </Pressable>
  );
}

export default function TodayScreen() {
  const { t, lang, prayer, lastRead } = useStore();
  const [ayah, setAyah] = useState<Hit | null>(null);
  const [hadith, setHadith] = useState<Hit | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    ayahOfTheDay().then(setAyah, () => {});
    hadithOfTheDay().then(setHadith, () => {});
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const pt = prayerTimes(prayer, now);
  const minutes = pt ? Math.max(0, Math.round((pt.nextTime.getTime() - now.getTime()) / 60000)) : 0;

  return (
    <Screen>
      <Pressable onPress={() => router.push('/prayer')}>
        <Card style={{ backgroundColor: C.primary, borderColor: C.primary }}>
          {pt ? (
            <>
              <T style={{ color: '#E3F0EA' }}>{t('nextPrayer')}</T>
              <T bold size={24} style={{ color: '#fff' }}>
                {t(`prayer_${pt.next}`)} · {formatTime(pt.nextTime, lang)}
              </T>
              <T style={{ color: '#E3F0EA' }}>{t('inTime', { h: Math.floor(minutes / 60), m: minutes % 60 })}</T>
            </>
          ) : (
            <>
              <T bold size={18} style={{ color: '#fff' }}>🕌 {t('prayerTimes')}</T>
              <T style={{ color: '#E3F0EA' }}>{t('setUpPrayer')}</T>
            </>
          )}
        </Card>
      </Pressable>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile icon="🌅" label={t('adhkar')} href="/adhkar" />
        <Tile icon="📿" label={t('tasbih')} href="/tasbih" />
        <Tile icon="📚" label={t('tabTopics')} href="/topics" />
        <Tile icon="🧭" label={t('qibla')} href="/prayer" />
      </View>

      {lastRead && (
        <Pressable onPress={() => router.push(`/quran/${lastRead.s}?ayah=${lastRead.a}&read=1`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T bold>📖 {t('continueReading')}</T>
              <T muted>
                {lastRead.s}:{lastRead.a}
              </T>
            </Row>
          </Card>
        </Pressable>
      )}

      <T bold size={17}>{t('ayahOfTheDay')}</T>
      {ayah ? <HitCard hit={ayah} full /> : <T muted>{t('loading')}</T>}
      <T bold size={17}>{t('hadithOfTheDay')}</T>
      {hadith ? <HitCard hit={hadith} full /> : <T muted>{t('loading')}</T>}
    </Screen>
  );
}
