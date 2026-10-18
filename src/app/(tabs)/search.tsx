import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { HitCard } from '../../components/HitCard';
import { Button, Chip, ErrorBox, Input, Loading, Row, Screen, T } from '../../components/ui';
import { COLLECTIONS } from '../../lib/data';
import { search, type Hit, type Source } from '../../lib/search';
import { useStore } from '../../lib/store';

type Filter = 'all' | Source;
type Result = { key: string; hits: Hit[] | null; error: unknown };
const PAGE = 20;

export default function SearchScreen() {
  const { t, lang } = useStore();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [paramSeen, setParamSeen] = useState(params.q);
  const [filter, setFilter] = useState<Filter>('all');
  const [cols, setCols] = useState<string[]>(COLLECTIONS.map((c) => c.id));
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [shown, setShown] = useState({ key: '', n: PAGE });

  // A topic page can open this screen with ?q=…; adopt it when it changes.
  if (params.q !== paramSeen) {
    setParamSeen(params.q);
    setQuery(params.q ?? '');
    setSubmitted(params.q ?? '');
  }

  const key = JSON.stringify([submitted.trim(), filter, cols, attempt]);
  useEffect(() => {
    if (!submitted.trim()) return;
    let cancelled = false;
    const sources: Source[] = filter === 'all' ? ['quran', 'hisn', 'hadith'] : [filter];
    search(submitted, { sources, collections: cols, limit: 500 }).then(
      (hits) => !cancelled && setResult({ key, hits, error: null }),
      (error) => !cancelled && setResult({ key, hits: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, submitted, filter, cols]);

  const busy = !!submitted.trim() && result?.key !== key;
  const current = result?.key === key ? result : null;
  const limit = shown.key === key ? shown.n : PAGE;

  const toggleCol = (id: string) =>
    setCols((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((c) => c !== id) : prev) : [...prev, id]));
  const submit = () => {
    if (query.trim() === submitted.trim()) setAttempt((a) => a + 1);
    setSubmitted(query);
  };

  return (
    <Screen>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t('searchPlaceholder')}
        returnKeyType="search"
        onSubmitEditing={submit}
        autoFocus={!params.q}
      />
      <Row>
        <Button title={t('tabSearch')} onPress={submit} disabled={busy || !query.trim()} />
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
      {!submitted.trim() && <T muted>{t('searchHint')}</T>}
      {busy && <Loading label={t('loadingLibrary')} />}
      {current?.error ? <ErrorBox error={current.error} onRetry={() => setAttempt((a) => a + 1)} /> : null}
      {current?.hits && (
        <>
          <T muted>
            {current.hits.length
              ? t('results', { n: current.hits.length >= 500 ? '500+' : current.hits.length })
              : t('noResults')}
          </T>
          {current.hits.slice(0, limit).map((h) => (
            <HitCard key={h.key} hit={h} query={submitted} />
          ))}
          {limit < current.hits.length && (
            <Button kind="secondary" title={t('showMore')} onPress={() => setShown({ key, n: limit + PAGE })} />
          )}
        </>
      )}
    </Screen>
  );
}
