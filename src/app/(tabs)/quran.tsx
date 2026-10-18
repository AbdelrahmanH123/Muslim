import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Arabic, C, Card, ErrorBox, Input, Loading, Row, T, styles } from '../../components/ui';
import { loadQuran, type Surah } from '../../lib/data';
import { useStore } from '../../lib/store';
import { normalize } from '../../lib/text';

export default function QuranIndexScreen() {
  const { t, lang, lastRead } = useStore();
  const [surahs, setSurahs] = useState<Surah[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadQuran().then((q) => setSurahs(q.surahs), setError);
  }, []);

  const shown = useMemo(() => {
    const f = normalize(filter).trim();
    if (!surahs || !f) return surahs ?? [];
    return surahs.filter((s) => String(s.n) === f || normalize(`${s.ar} ${s.tr} ${s.en}`).includes(f));
  }, [surahs, filter]);

  if (error) return <View style={styles.inner}><ErrorBox error={error} /></View>;
  if (!surahs) return <Loading />;
  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(s) => String(s.n)}
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {lastRead && (
              <Pressable onPress={() => router.push(`/quran/${lastRead.s}?ayah=${lastRead.a}&read=1`)}>
                <Card style={{ backgroundColor: C.goldSoft, borderColor: C.gold }}>
                  <T bold>
                    📖 {t('continueReading')}: {surahs[lastRead.s - 1]?.[lang === 'ar' ? 'ar' : 'tr']} {lastRead.s}:{lastRead.a}
                  </T>
                </Card>
              </Pressable>
            )}
            <Input value={filter} onChangeText={setFilter} placeholder={t('filterSurahs')} autoCorrect={false} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item: s }) => (
          <Pressable onPress={() => router.push(`/quran/${s.n}`)}>
            <Card>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <Row style={{ flexWrap: 'nowrap', flexShrink: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <T bold style={{ color: C.primary, textAlign: 'center' }}>{s.n}</T>
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <T bold>{s.tr}</T>
                    <T muted size={13}>
                      {s.en} · {s.count} {t('ayah')} · {s.rev === 'Mecca' ? t('meccan') : t('medinan')}
                    </T>
                  </View>
                </Row>
                <Arabic size={22} style={{ lineHeight: 34 }}>{s.ar}</Arabic>
              </Row>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
