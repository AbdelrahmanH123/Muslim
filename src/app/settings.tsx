import { useState } from 'react';
import { Button, C, Card, Chip, ErrorBox, Input, Row, Screen, T } from '../components/ui';
import { testConnection } from '../lib/ai';
import { DEFAULT_AI, useStore, type AiSettings } from '../lib/store';

const MODELS = ['qwen2.5:3b', 'qwen2.5:7b', 'gemma3:4b', 'llama3.2:3b'];

export default function SettingsScreen() {
  const { t, lang, setLang, ai, setAi } = useStore();
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const test = async () => {
    setBusy(true);
    setStatus('');
    setError(null);
    try {
      setAi(draft);
      const models = await testConnection(draft);
      setStatus(`${t('connectionOk')} ${models}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <T bold size={17}>{t('language')}</T>
        <Row>
          <Chip label="English" active={lang === 'en'} onPress={() => setLang('en')} />
          <Chip label="العربية" active={lang === 'ar'} onPress={() => setLang('ar')} />
        </Row>
      </Card>

      <Card>
        <T bold size={17}>{t('aiSettings')}</T>
        <T muted size={13}>{t('aiHelp')}</T>
        <T bold>{t('provider')}</T>
        <Row>
          <Chip
            label="Ollama"
            active={draft.provider === 'ollama'}
            onPress={() => setDraft({ ...draft, provider: 'ollama', baseUrl: DEFAULT_AI.baseUrl })}
          />
          <Chip
            label="OpenAI-compatible (LM Studio, …)"
            active={draft.provider === 'openai'}
            onPress={() => setDraft({ ...draft, provider: 'openai', baseUrl: 'http://localhost:1234/v1' })}
          />
        </Row>
        <T bold>{t('baseUrl')}</T>
        <Input value={draft.baseUrl} onChangeText={(baseUrl) => setDraft({ ...draft, baseUrl })} autoCapitalize="none" autoCorrect={false} />
        <T bold>{t('model')}</T>
        <Input value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} autoCapitalize="none" autoCorrect={false} />
        <Row>
          {MODELS.map((m) => (
            <Chip key={m} label={m} active={draft.model === m} onPress={() => setDraft({ ...draft, model: m })} />
          ))}
        </Row>
        {draft.provider === 'openai' && (
          <>
            <T bold>{t('apiKey')}</T>
            <Input value={draft.apiKey} onChangeText={(apiKey) => setDraft({ ...draft, apiKey })} autoCapitalize="none" secureTextEntry />
          </>
        )}
        <Row>
          <Button title={t('save')} onPress={() => setAi(draft)} />
          <Button kind="secondary" title={t('testConnection')} onPress={test} disabled={busy} />
        </Row>
        {status ? <T style={{ color: C.primary }}>{status}</T> : null}
        {error ? <ErrorBox error={error} /> : null}
      </Card>

      <Card>
        <T bold size={17}>{t('about')}</T>
        <T muted size={13}>{t('aboutText')}</T>
      </Card>
    </Screen>
  );
}
