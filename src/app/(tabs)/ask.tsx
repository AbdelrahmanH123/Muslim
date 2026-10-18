import { useState } from 'react';
import { HitCard } from '../../components/HitCard';
import { Button, C, Card, English, errorText, Input, Loading, Row, Screen, T } from '../../components/ui';
import { ask, retrieve } from '../../lib/ai';
import type { Hit } from '../../lib/search';
import { useStore } from '../../lib/store';
import { hasArabic } from '../../lib/text';

type Turn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; sources: Hit[]; cited: number[]; offline?: string };

export default function AskScreen() {
  const { t, lang, ai } = useStore();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    const history = turns.map((x) => ({ role: x.role, content: x.text }));
    setTurns((prev) => [...prev, { role: 'user', text: q }]);
    setBusy(true);
    let reply: Turn;
    try {
      const r = await ask(ai, q, hasArabic(q) ? 'ar' : lang, history);
      reply = { role: 'assistant', text: r.answer, sources: r.sources, cited: r.cited };
    } catch (e) {
      // AI not reachable: still show what the library has.
      const sources = await retrieve(q).catch(() => []);
      reply = { role: 'assistant', text: '', sources, cited: [], offline: errorText(e, t) };
    }
    setTurns((prev) => [...prev, reply]);
    setBusy(false);
  };

  return (
    <Screen>
      {turns.length === 0 && (
        <Card style={{ backgroundColor: C.primarySoft, borderColor: C.primarySoft }}>
          <T>{t('askIntro')}</T>
          <T muted size={13}>{t('aiDisclaimer')}</T>
        </Card>
      )}
      {turns.map((turn, i) =>
        turn.role === 'user' ? (
          <Card key={i} style={{ alignSelf: 'flex-end', backgroundColor: C.primary, borderColor: C.primary, maxWidth: '90%' }}>
            <T style={{ color: '#fff' }}>{turn.text}</T>
          </Card>
        ) : (
          <AssistantTurn key={i} turn={turn} />
        ),
      )}
      {busy && <Loading label={t('thinking')} />}
      <Input value={input} onChangeText={setInput} placeholder={t('askPlaceholder')} multiline onSubmitEditing={send} />
      <Row>
        <Button title={t('send')} onPress={send} disabled={busy || !input.trim()} />
      </Row>
    </Screen>
  );
}

function AssistantTurn({ turn }: { turn: Extract<Turn, { role: 'assistant' }> }) {
  const { t } = useStore();
  const shown = turn.cited.length ? turn.cited.map((n) => ({ hit: turn.sources[n - 1], n })) : turn.sources.map((hit, i) => ({ hit, n: i + 1 }));
  return (
    <>
      <Card>
        {turn.offline ? (
          <>
            <T bold>{t('aiNotConnected')}</T>
            <T muted size={12}>{turn.offline}</T>
          </>
        ) : (
          <>
            {hasArabic(turn.text) ? <T style={{ textAlign: 'right', writingDirection: 'rtl' }}>{turn.text}</T> : <English>{turn.text}</English>}
            {turn.cited.length === 0 && (
              <T size={13} style={{ color: C.warn }}>
                {t('noCitations')}
              </T>
            )}
            <T muted size={12}>{t('aiDisclaimer')}</T>
          </>
        )}
      </Card>
      {shown.length > 0 && <T bold>{t('sources')}</T>}
      {shown.map(({ hit, n }) => (
        <HitCard key={hit.key + n} hit={hit} number={n} />
      ))}
    </>
  );
}
