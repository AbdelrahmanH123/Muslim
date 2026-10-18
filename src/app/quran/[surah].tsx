import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { favoriteFromHit } from '../../components/HitCard';
import { Arabic, Button, C, Card, Chip, English, ErrorBox, Loading, Row, SaveButton, T, styles } from '../../components/ui';
import { ayahIndex, loadQuran, loadTafsir, TAFSIRS, type Ayah, type Quran } from '../../lib/data';
import type { Hit } from '../../lib/search';
import { useStore } from '../../lib/store';

export default function SurahScreen() {
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const s = Number(params.surah);
  const focus = params.ayah ? Number(params.ayah) : null;
  const { t, lang } = useStore();
  const [quran, setQuran] = useState<Quran | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [showAll, setShowAll] = useState(!focus);

  useEffect(() => {
    loadQuran().then(setQuran, setError);
  }, []);

  if (error) return <View style={styles.inner}><ErrorBox error={error} /></View>;
  if (!quran) return <Loading />;
  const surah = quran.surahs[s - 1];
  if (!surah) return <View style={styles.inner}><T>Not found</T></View>;
  const start = ayahIndex(quran, s, 1);
  const ayat = quran.ayat.slice(start, start + surah.count);
  const title = lang === 'ar' ? surah.ar : `${surah.n}. ${surah.tr} — ${surah.en}`;
  const focused = focus ? ayat[focus - 1] : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: lang === 'ar' ? surah.ar : surah.tr }} />
      <FlatList
        data={showAll ? ayat : []}
        keyExtractor={(a) => `${a.s}:${a.a}`}
        contentContainerStyle={[styles.inner, { flexGrow: 1 }]}
        initialNumToRender={12}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Card style={{ alignItems: 'center' }}>
              <Arabic size={28} style={{ textAlign: 'center' }}>{surah.ar}</Arabic>
              <T muted style={{ textAlign: 'center' }}>{title} · {surah.count} {t('ayah')} · {surah.rev}</T>
            </Card>
            {focused && <AyahCard ayah={focused} quran={quran} highlight />}
            {!showAll && <Button kind="secondary" title={t('openSurah')} onPress={() => setShowAll(true)} />}
          </View>
        }
        renderItem={({ item }) => <AyahCard ayah={item} quran={quran} highlight={item.a === focus} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListFooterComponent={<T muted size={12}>{quran.source.arabic} · {quran.source.english}</T>}
      />
    </View>
  );
}

function AyahCard({ ayah, quran, highlight }: { ayah: Ayah; quran: Quran; highlight?: boolean }) {
  const { t, lang } = useStore();
  const [tafsirId, setTafsirId] = useState<string | null>(null);
  const [tafsir, setTafsir] = useState<string | null>(null);
  const surah = quran.surahs[ayah.s - 1];
  const hit: Hit = { kind: 'quran', key: `q:${ayah.s}:${ayah.a}`, score: 1, ayah, surahName: surah };

  useEffect(() => {
    if (!tafsirId) return;
    setTafsir(null);
    loadTafsir(tafsirId).then((x) => setTafsir(x.text[ayahIndex(quran, ayah.s, ayah.a)] ?? ''), (e) => setTafsir(String(e)));
  }, [tafsirId, ayah, quran]);

  return (
    <Card style={highlight ? { borderColor: C.gold, borderWidth: 2, backgroundColor: C.goldSoft } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T bold style={{ color: C.primary }}>
          {ayah.s}:{ayah.a}
        </T>
        <Row>
          <Button
            small
            kind="secondary"
            title={tafsirId ? t('hideTafsir') : t('showTafsir')}
            onPress={() => setTafsirId(tafsirId ? null : TAFSIRS[0].id)}
          />
          <SaveButton item={favoriteFromHit(hit)} />
        </Row>
      </Row>
      <Arabic size={26}>{ayah.ar}</Arabic>
      <English>{ayah.en}</English>
      {tafsirId && (
        <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
          <Row>
            {TAFSIRS.map((x) => (
              <Chip key={x.id} label={x.name[lang]} active={tafsirId === x.id} onPress={() => setTafsirId(x.id)} />
            ))}
          </Row>
          {tafsir == null ? <Loading /> : <Arabic size={19}>{tafsir}</Arabic>}
        </View>
      )}
    </Card>
  );
}
