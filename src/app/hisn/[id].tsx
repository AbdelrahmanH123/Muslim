import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { favoriteFromHit } from '../../components/HitCard';
import { Arabic, C, Card, ErrorBox, Loading, Row, SaveButton, Screen, ShareButton, T } from '../../components/ui';
import { citationText } from '../../lib/format';
import { loadHisn, type Hisn } from '../../lib/data';
import { useStore } from '../../lib/store';

export default function HisnScreen() {
  const { id, item } = useLocalSearchParams<{ id: string; item?: string }>();
  const { t, lang } = useStore();
  const [hisn, setHisn] = useState<Hisn | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    loadHisn().then(setHisn, setError);
  }, []);

  if (error) return <Screen><ErrorBox error={error} /></Screen>;
  if (!hisn) return <Loading />;
  const chapter = hisn.chapters[Number(id)];
  if (!chapter) return <Screen><T>Not found</T></Screen>;
  const focus = item != null ? Number(item) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: lang === 'ar' ? chapter.ar : chapter.en }} />
      <Card>
        <Arabic size={24}>{chapter.ar}</Arabic>
        {chapter.en ? <T bold>{chapter.en}</T> : null}
        <T muted size={13}>{hisn.name[lang]}</T>
        <T muted size={13}>{t('hisnNote')}</T>
      </Card>
      {chapter.text.map((text, i) => (
        <Card key={i} style={i === focus ? { borderColor: C.gold, borderWidth: 2, backgroundColor: C.goldSoft } : undefined}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T bold style={{ color: C.primary }}>{i + 1}</T>
            <Row style={{ flexWrap: 'nowrap' }}>
              <ShareButton text={() => citationText({ kind: 'hisn', key: `d:${chapter.id}:${i}`, score: 1, chapter, index: i }, lang)} />
              <SaveButton item={favoriteFromHit({ kind: 'hisn', key: `d:${chapter.id}:${i}`, score: 1, chapter, index: i })} />
            </Row>
          </Row>
          <Arabic size={23}>{text}</Arabic>
        </Card>
      ))}
      {chapter.notes.length > 0 && (
        <Card>
          <T bold>{t('references')}</T>
          {chapter.notes.map((n, i) => (
            <Arabic key={i} size={17}>{n}</Arabic>
          ))}
        </Card>
      )}
    </Screen>
  );
}
