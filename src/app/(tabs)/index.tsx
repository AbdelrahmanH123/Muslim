import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { HitCard } from '../../components/HitCard';
import { Button, Chip, ErrorBox, Input, Loading, Row, Screen, T } from '../../components/ui';
import { COLLECTIONS } from '../../lib/data';
import { search, type Hit, type Source } from '../../lib/search';
import { useStore } from '../../lib/store';

type Filter = 'all' | Source;
const PAGE = 20;

export default function SearchScreen() {
  const { t, lang } = useStore();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [cols, setCols] = useState<string[]>(COLLECTIONS.map((c) => c.id));
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [ran, setRan] = useState('');

  const run = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const sources: Source[] = filter === 'all' ? ['quran', 'hisn', 'hadith'] : [filter];
        setHits(await search(q, { sources, collections: cols, limit: 500 }));
        setShown(PAGE);
        setRan(q);
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    },
    [filter, cols],
  );

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      run(params.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  useEffect(() => {
    if (ran) run(ran);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, cols]);

  const toggleCol = (id: string) =>
    setCols((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((c) => c !== id) : prev) : [...prev, id]));

  return (
    <Screen>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t('searchPlaceholder')}
        returnKeyType="search"
        onSubmitEditing={() => run(query)}
        autoFocus={!params.q}
      />
      <Row>
        <Button title={t('tabSearch')} onPress={() => run(query)} disabled={busy || !query.trim()} />
        <Chip label={t('filterAll')} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t('filterQuran')} active={filter === 'quran'} onPress={() => setFilter('quran')} />
        <Chip label={t('filterDuas')} active={filter === 'hisn'} onPress={() => setFilter('hisn')} />
        <Chip label={t('filterHadith')} active={filter === 'hadith'} onPress={() => setFilter('hadith')} />
      </Row>
      {(filter === 'all' || filter === 'hadith') && (
        <Row>
          <T muted size={13}>
            {t('collectionsLabel')}:
          </T>
          {COLLECTIONS.map((c) => (
            <Chip key={c.id} label={c.name[lang]} active={cols.includes(c.id)} onPress={() => toggleCol(c.id)} />
          ))}
        </Row>
      )}
      {!hits && !busy && <T muted>{t('searchHint')}</T>}
      {busy && <Loading label={t('loadingLibrary')} />}
      {error ? <ErrorBox error={error} onRetry={() => run(query)} /> : null}
      {hits && !busy && (
        <>
          <T muted>{hits.length ? t('results', { n: hits.length >= 500 ? '500+' : hits.length }) : t('noResults')}</T>
          {hits.slice(0, shown).map((h) => (
            <HitCard key={h.key} hit={h} query={ran} />
          ))}
          {shown < hits.length && <Button kind="secondary" title={t('showMore')} onPress={() => setShown((s) => s + PAGE)} />}
        </>
      )}
    </Screen>
  );
}
