import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { HitCard } from '../../components/HitCard';
import { Button, ErrorBox, LinkCard, Loading, Screen, T } from '../../components/ui';
import { loadHisn, type Hisn } from '../../lib/data';
import { getByKey, type Hit } from '../../lib/search';
import { useStore } from '../../lib/store';
import { TOPICS } from '../../lib/topics';

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useStore();
  const topic = TOPICS.find((x) => x.id === id);
  const [ayat, setAyat] = useState<Hit[] | null>(null);
  const [hisn, setHisn] = useState<Hisn | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!topic) return;
    (async () => {
      try {
        const keys = topic.ayat.flatMap(([s, from, to]) =>
          Array.from({ length: (to ?? from) - from + 1 }, (_, i) => `q:${s}:${from + i}`),
        );
        const hits = await Promise.all(keys.map(getByKey));
        setAyat(hits.filter((h): h is Hit => !!h));
        setHisn(await loadHisn());
      } catch (e) {
        setError(e);
      }
    })();
  }, [topic]);

  if (!topic) return <Screen><T>Not found</T></Screen>;
  const title = lang === 'ar' ? topic.ar : topic.en;
  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <T bold size={22}>
        {topic.icon} {title}
      </T>
      {error ? <ErrorBox error={error} /> : null}
      {!ayat && !error && <Loading />}
      {hisn && (
        <>
          <T bold size={17}>{t('hisnChapters')}</T>
          {topic.hisn.map((cid) => {
            const c = hisn.chapters[cid];
            return (
              <LinkCard key={cid} href={`/hisn/${cid}`}>
                <T bold>{lang === 'ar' ? c.ar : c.en}</T>
                {lang !== 'ar' && <T muted style={{ textAlign: 'right', writingDirection: 'rtl' }}>{c.ar}</T>}
              </LinkCard>
            );
          })}
        </>
      )}
      {ayat && (
        <>
          <T bold size={17}>{t('featuredAyat')}</T>
          {ayat.map((h) => (
            <HitCard key={h.key} hit={h} full />
          ))}
        </>
      )}
      <Button kind="secondary" title={t('relatedSearch')} onPress={() => router.push({ pathname: '/search', params: { q: topic.query } })} />
    </Screen>
  );
}
