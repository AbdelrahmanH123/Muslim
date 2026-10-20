import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button, C, Card, Chip, ErrorBox, Input, Row, Screen, T } from '../components/ui';
import { AI_PRESETS, findOllamaOnWifi, testConnection, type AiPreset } from '../lib/ai';
import { useStore, type AiSettings } from '../lib/store';

const OLLAMA_SUGGESTED = ['qwen2.5:3b', 'qwen2.5:7b', 'gemma3:4b', 'llama3.2:3b'];

export default function SettingsScreen() {
  const { t, lang, setLang, ai, setAi } = useStore();
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [scan, setScan] = useState<number | null>(null);

  const presets = AI_PRESETS.filter((p) => !p.native || Platform.OS !== 'web');
  const preset: AiPreset | undefined = presets.find((p) => p.id === draft.preset);

  const choose = (p: AiPreset) => {
    setDraft({ ...draft, preset: p.id, provider: p.provider, baseUrl: p.baseUrl || draft.baseUrl, model: p.defaultModel ?? (p.provider === 'ollama' ? 'qwen2.5:3b' : '') });
    setModels(null);
    setStatus('');
    setError(null);
  };

  const test = async (settings = draft) => {
    setBusy(true);
    setStatus('');
    setError(null);
    try {
      setAi(settings);
      let names = await testConnection(settings);
      const p = AI_PRESETS.find((x) => x.id === settings.preset);
      if (p?.freeModels) names = names.filter(p.freeModels);
      setModels(names.slice(0, 40));
      if (!names.length) setStatus(settings.provider === 'ollama' ? t('aiNoModels') : t('connectionOk'));
      else if (names.some((n) => n === settings.model || n === `${settings.model}:latest`)) setStatus(t('connectionOk'));
      else {
        // The chosen model is not on this server: switch to the first one it has.
        const next = { ...settings, model: names[0] };
        setDraft(next);
        setAi(next);
        setStatus(t('aiPickModel'));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const findComputer = async () => {
    setError(null);
    setStatus('');
    setScan(0);
    const url = await findOllamaOnWifi((done, total) => setScan(Math.round((100 * done) / total)));
    setScan(null);
    if (!url) {
      setError(new Error('AI_PHONE_LOCALHOST'));
      setStatus(t('aiNotFound'));
      return;
    }
    const next = { ...draft, preset: 'ollama-wifi', provider: 'ollama' as const, baseUrl: url };
    setDraft(next);
    setStatus(t('aiFound', { url }));
    await test(next);
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
        <T bold>{t('aiChoose')}</T>
        <Row>
          {presets.map((p) => (
            <Chip key={p.id} label={p.label} active={draft.preset === p.id} onPress={() => choose(p)} />
          ))}
        </Row>

        {draft.preset === 'ollama-wifi' && (
          <Button title={scan == null ? t('aiFindComputer') : t('aiSearching', { n: scan })} onPress={findComputer} disabled={scan != null} />
        )}
        {preset?.keyUrl && (
          <>
            <Row>
              <Button small kind="secondary" title={`🔑 ${draft.provider === 'anthropic' ? t('aiGetKeyPaid') : t('aiGetKey')}`} onPress={() => Linking.openURL(preset.keyUrl!)} />
            </Row>
            <T bold>{t('apiKey')}</T>
            <Input value={draft.apiKey} onChangeText={(apiKey) => setDraft({ ...draft, apiKey: apiKey.trim() })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
            <T muted size={12}>{draft.provider === 'anthropic' ? t('claudeNote') : t('aiCloudNote')}</T>
          </>
        )}

        {draft.provider !== 'anthropic' && (
          <>
            <T bold>{t('baseUrl')}</T>
            <Input value={draft.baseUrl} onChangeText={(baseUrl) => setDraft({ ...draft, baseUrl: baseUrl.trim() })} autoCapitalize="none" autoCorrect={false} />
          </>
        )}
        <T bold>{t('model')}</T>
        <Input value={draft.model} onChangeText={(model) => setDraft({ ...draft, model: model.trim() })} autoCapitalize="none" autoCorrect={false} />
        {models && models.length > 0 ? (
          <>
            <T muted size={13}>{t('aiModels')}</T>
            <Row>
              {models.map((m) => (
                <Chip key={m} label={m} active={draft.model === m} onPress={() => { const next = { ...draft, model: m }; setDraft(next); setAi(next); }} />
              ))}
            </Row>
          </>
        ) : (
          draft.provider === 'ollama' && (
            <Row>
              {OLLAMA_SUGGESTED.map((m) => (
                <Chip key={m} label={m} active={draft.model === m} onPress={() => setDraft({ ...draft, model: m })} />
              ))}
            </Row>
          )
        )}
        <Row>
          <Button title={t('save')} onPress={() => setAi(draft)} />
          <Button kind="secondary" title={busy ? t('loading') : t('testConnection')} onPress={() => test()} disabled={busy || scan != null} />
        </Row>
        {status ? <T style={{ color: C.primary }}>{status}</T> : null}
        {error ? <ErrorBox error={error} /> : null}
        {draft.provider === 'ollama' && <T muted size={12}>{t('aiHelp')}</T>}
      </Card>

      <Card>
        <T bold size={17}>{t('about')}</T>
        <T muted size={13}>{t('aboutText')}</T>
      </Card>
    </Screen>
  );
}
