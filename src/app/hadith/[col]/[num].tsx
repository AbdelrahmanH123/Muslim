import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { favoriteFromHit } from '../../../components/HitCard';
import { Arabic, C, Card, English, ErrorBox, GradeBadge, Loading, Row, SaveButton, Screen, T } from '../../../components/ui';
import { loadCollection, type Collection } from '../../../lib/data';
import { hadithRef } from '../../../lib/format';
import { hadithGrade } from '../../../lib/grades';
import { useStore } from '../../../lib/store';

export default function HadithScreen() {
  const { col, num } = useLocalSearchParams<{ col: string; num: string }>();
  const { t, lang } = useStore();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    loadCollection(col).then(setCollection, setError);
  }, [col]);

  if (error) return <Screen><ErrorBox error={error} /></Screen>;
  if (!collection) return <Loading />;
  const h = collection.byNumber.get(String(num));
  if (!h) return <Screen><T>Not found</T></Screen>;
  const level = hadithGrade(h);
  const title = hadithRef(col, h.n, lang);
  const book = collection.sections[String(h.book)];

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T bold size={18} style={{ color: C.primary, flexShrink: 1 }}>{title}</T>
          <SaveButton item={favoriteFromHit({ kind: 'hadith', key: `h:${col}:${h.n}`, score: 1, hadith: h })} />
        </Row>
        {book ? (
          <T muted>
            {t('book')} {h.book}: {book}
          </T>
        ) : null}
        {h.narrator ? (
          <T>
            <T bold>{t('narrator')}: </T>
            {h.narrator}
          </T>
        ) : null}
      </Card>

      <Card>
        <T bold>{t('grade')}</T>
        <GradeBadge level={level} />
        {collection.sahih ? <T muted size={13}>{t('sahihCollection')}</T> : null}
        {h.grades.map(([by, grade], i) => (
          <T key={i} size={14}>
            • {grade} — <T muted size={14}>{t('gradedBy')} {by}</T>
          </T>
        ))}
      </Card>

      {h.ar ? (
        <Card>
          <Arabic size={23}>{h.ar}</Arabic>
        </Card>
      ) : null}
      {h.en ? (
        <Card>
          <English>{h.en}</English>
        </Card>
      ) : null}
      <View>
        <T muted size={12}>
          {t('reference')}: {hadithRef(col, h.n, 'en')} · fawazahmed0/hadith-api, Sunnah.com
        </T>
      </View>
    </Screen>
  );
}
