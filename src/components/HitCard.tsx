import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { collectionInfo } from '../lib/data';
import { hitArabic, hitEnglish, hitGrade, hitHref, hitTitle } from '../lib/format';
import type { Hit } from '../lib/search';
import { useStore, type Favorite } from '../lib/store';
import { snippet } from '../lib/text';
import { Arabic, Badge, C, Card, English, GradeBadge, Row, SaveButton, T } from './ui';

export function favoriteFromHit(hit: Hit): Omit<Favorite, 'added' | 'folder'> {
  const source =
    hit.kind === 'quran' ? 'Quran' : hit.kind === 'hisn' ? 'Hisn al-Muslim' : collectionInfo(hit.hadith.col)?.name.en ?? hit.hadith.col;
  return { key: hit.key, title: hitTitle(hit, 'en'), ar: hitArabic(hit), en: hitEnglish(hit), source };
}

export function HitCard({ hit, query = '', number, full }: { hit: Hit; query?: string; number?: number; full?: boolean }) {
  const { t, lang } = useStore();
  const grade = hitGrade(hit);
  const ar = hitArabic(hit);
  const en = hitEnglish(hit);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Pressable style={{ flexShrink: 1 }} onPress={() => router.push(hitHref(hit) as never)}>
          <T bold style={{ color: C.primary }}>
            {number != null ? `[${number}] ` : ''}
            {hitTitle(hit, lang)}
          </T>
        </Pressable>
        <SaveButton item={favoriteFromHit(hit)} />
      </Row>
      <Pressable style={{ gap: 8 }} onPress={() => router.push(hitHref(hit) as never)}>
      <Row>
        {hit.kind === 'quran' && <Badge label={t('quran')} color={C.gold} bg={C.goldSoft} />}
        {hit.kind === 'hisn' && <Badge label={t('hisn')} color={C.primary} bg={C.primarySoft} />}
        {grade && <GradeBadge level={grade} />}
        {hit.kind === 'hadith' && hit.hadith.narrator ? (
          <T muted size={13}>
            {t('narrator')}: {hit.hadith.narrator}
          </T>
        ) : null}
      </Row>
      {ar ? <Arabic size={full ? 24 : 20}>{full ? ar : snippet(ar, query, 260)}</Arabic> : null}
      {en ? <English style={{ color: C.muted }}>{full ? en : snippet(en, query, 260)}</English> : null}
      </Pressable>
    </Card>
  );
}
