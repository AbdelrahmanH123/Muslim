// Claude (Anthropic API) provider, called directly from the app with the user's own API key.
import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5-5';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// The key belongs to the user and stays on their device, so calling the API from the app is intended here.
const clientFor = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

/** Maps SDK errors to the app's error codes (shown as step-by-step help in the UI). */
function explain(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new Error('AI_BAD_KEY');
  if (e instanceof Anthropic.RateLimitError) throw new Error('AI_RATE_LIMIT');
  if (e instanceof Anthropic.APIConnectionError) throw new Error('AI_UNREACHABLE');
  throw e;
}

export async function claudeModels(apiKey: string): Promise<string[]> {
  try {
    const ids: string[] = [];
    for await (const m of clientFor(apiKey).models.list()) ids.push(m.id);
    return ids;
  } catch (e) {
    explain(e);
  }
}

/** One answer from Claude. With `schema`, the reply is guaranteed to be JSON matching it (structured outputs). */
export async function claudeComplete(
  apiKey: string,
  model: string,
  messages: Msg[],
  schema?: Record<string, unknown>,
): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages
    .filter((m): m is Msg & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  try {
    const response = await clientFor(apiKey).beta.messages.create({
      model: model || CLAUDE_DEFAULT_MODEL,
      max_tokens: 16000,
      system,
      messages: turns,
      ...(schema ? { output_config: { format: { type: 'json_schema' as const, schema } } } : {}),
      // If a safety classifier declines, the API retries the request on a suitable fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'refusal') throw new Error('AI_REFUSED');
    return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch (e) {
    if (e instanceof Error && e.message === 'AI_REFUSED') throw e;
    explain(e);
  }
}
