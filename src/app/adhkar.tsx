import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Arabic, C, Card, Chip, ErrorBox, Loading, Row, Screen, ShareButton, T } from '../components/ui';
import { loadHisn, type Hisn } from '../lib/data';
import { citationText } from '../lib/format';
import { today, usePersisted } from '../lib/persist';
import { useStore } from '../lib/store';

// Hisn al-Muslim chapters (ids in hisn.json): 28 = morning & evening, 29 = before sleeping.
const SESSIONS = { morning: 28, evening: 28, sleep: 29 } as const;
type Session = keyof typeof SESSIONS;
type Progress = { date: string } & Record<Session, number[]>;

const sessionNow = (): Session => {
  const h = new Date().getHours();
  return h >= 21 || h < 3 ? 'sleep' : h >= 15 ? 'evening' : 'morning';
};

export default function AdhkarScreen() {
  const { t, lang } = useStore();
  const [hisn, setHisn] = useState<Hisn | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [session, setSession] = useState<Session>(sessionNow);
  const [progress, setProgress] = usePersisted<Progress>('adhkar', { date: today(), morning: [], evening: [], sleep: [] });

  useEffect(() => {
    loadHisn().then(setHisn, setError);
  }, []);

  // A new day starts with an empty checklist.
  const p = progress.date === today() ? progress : { date: today(), morning: [], evening: [], sleep: [] };
  const done = new Set(p[session]);
  const toggle = (i: number) =>
    setProgress({ ...p, [session]: done.has(i) ? p[session].filter((x) => x !== i) : [...p[session], i] });

  if (error) return <Screen><ErrorBox error={error} /></Screen>;
  if (!hisn) return <Loading />;
  const chapter = hisn.chapters[SESSIONS[session]];
  // The first item of the morning & evening chapter is the author's opening line, not a dhikr.
  const items = chapter.text.map((text, i) => ({ text, i })).filter(({ i }) => !(SESSIONS[session] === 28 && i === 0));
  const count = items.filter(({ i }) => done.has(i)).length;

  return (
    <Screen>
      <Row>
        {(Object.keys(SESSIONS) as Session[]).map((s) => (
          <Chip key={s} label={t(`session_${s}`)} active={session === s} onPress={() => setSession(s)} />
        ))}
      </Row>
      <Card>
        <T bold>
          {t('progress')}: {count} / {items.length}
        </T>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.primarySoft, overflow: 'hidden' }}>
          <View style={{ width: `${(100 * count) / Math.max(1, items.length)}%`, height: 8, backgroundColor: C.primary }} />
        </View>
        <T muted size={12}>{t('adhkarSource')}</T>
      </Card>
      {items.map(({ text, i }) => {
        const isDone = done.has(i);
        return (
          <Card key={i} style={isDone ? { backgroundColor: C.primarySoft, borderColor: C.primarySoft } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable onPress={() => toggle(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.primary, backgroundColor: isDone ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {isDone ? <T bold style={{ color: '#fff', textAlign: 'center' }}>✓</T> : null}
                </View>
                <T bold style={{ color: C.primary }}>{isDone ? t('done') : t('markDone')}</T>
              </Pressable>
              <ShareButton text={() => citationText({ kind: 'hisn', key: `d:${chapter.id}:${i}`, score: 1, chapter, index: i }, lang)} />
            </Row>
            <Pressable onPress={() => toggle(i)}>
              <Arabic size={22} style={isDone ? { color: C.muted } : undefined}>{text}</Arabic>
            </Pressable>
          </Card>
        );
      })}
      {chapter.notes.length > 0 && (
        <Card>
          <T bold>{t('references')}</T>
          {chapter.notes.map((n, k) => (
            <Arabic key={k} size={16}>{n}</Arabic>
          ))}
        </Card>
      )}
    </Screen>
  );
}
