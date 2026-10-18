import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { HitCard } from '../../components/HitCard';
import { Button, C, Card, English, ErrorBox, errorText, Input, Loading, Row, Screen, T } from '../../components/ui';
import { verify, type Verdict, type VerifyResult } from '../../lib/ai';
import { useStore } from '../../lib/store';
import { hasArabic } from '../../lib/text';

const VERDICT_STYLE: Record<Verdict, { icon: string; bg: string; fg: string }> = {
  found: { icon: '✅', bg: C.primarySoft, fg: C.primary },
  weak: { icon: '⚠️', bg: C.warnSoft, fg: C.warn },
  partial: { icon: '🔀', bg: C.goldSoft, fg: C.gold },
  not_found: { icon: '❓', bg: '#EEEEEE', fg: C.muted },
};

// Browser speech recognition (Chrome, Edge, Safari). Free and built in; not available in every browser.
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: any) => void; onend: () => void };
function getRecognition(): Recognition | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const R = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  return R ? new R() : null;
}

export default function VerifyScreen() {
  const { t, lang, ai } = useStore();
  const [claim, setClaim] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [aiError, setAiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const canListen = Platform.OS === 'web' && typeof window !== 'undefined' && !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

  const check = async () => {
    const c = claim.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    setAiError('');
    setResult(null);
    const replyLang = hasArabic(c) ? 'ar' : lang;
    try {
      try {
        setResult(await verify(c, replyLang, ai));
      } catch (e) {
        setAiError(errorText(e, t));
        setResult(await verify(c, replyLang, null));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleListen = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) return;
    r.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    r.interimResults = true;
    r.continuous = true;
    const before = claim ? claim + ' ' : '';
    r.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setClaim(before + text);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  const v = result ? VERDICT_STYLE[result.verdict] : null;
  return (
    <Screen>
      <T muted>{t('verifyIntro')}</T>
      <Input value={claim} onChangeText={setClaim} placeholder={t('verifyPlaceholder')} multiline />
      <Row>
        <Button title={t('verifyButton')} onPress={check} disabled={busy || !claim.trim()} />
        {canListen && <Button kind="secondary" title={listening ? t('stopListening') : t('listen')} onPress={toggleListen} />}
      </Row>
      {Platform.OS !== 'web' && <T muted size={13}>{t('micTip')}</T>}
      {busy && <Loading label={t('thinking')} />}
      {error ? <ErrorBox error={error} onRetry={check} /> : null}
      {result && v && (
        <>
          <Card style={{ backgroundColor: v.bg, borderColor: v.bg }}>
            <T bold size={18} style={{ color: v.fg }}>
              {v.icon} {t(`verdict_${result.verdict}`)}
            </T>
            <T>{t(`verdict_${result.verdict}_desc`)}</T>
            {result.explanation ? (
              <>
                <T bold>{t('aiExplanation')}</T>
                {hasArabic(result.explanation) ? (
                  <T style={{ textAlign: 'right', writingDirection: 'rtl' }}>{result.explanation}</T>
                ) : (
                  <English>{result.explanation}</English>
                )}
              </>
            ) : null}
            {aiError ? (
              <>
                <T size={13} style={{ color: C.warn }}>{t('aiNotConnected')}</T>
                <T muted size={12}>{aiError}</T>
              </>
            ) : null}
            <T muted size={12}>{t('aiDisclaimer')}</T>
          </Card>
          {result.matches.length > 0 && <T bold>{t('closestMatches')}</T>}
          {result.matches.map((h, i) => (
            <HitCard key={h.key} hit={h} number={i + 1} />
          ))}
        </>
      )}
    </Screen>
  );
}
