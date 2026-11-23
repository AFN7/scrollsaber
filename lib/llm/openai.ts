import {
  LLMError,
  type ProviderTestResult,
  type ShortenRequest,
  type ShortenResult,
} from '@/lib/types';
import { creditsFromTokens } from '@/lib/credits/policy';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { validateShortenResponse } from './validator';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface ChatResponse {
  model?: string;
  choices?: Array<{ message?: ChatMessage; finish_reason?: string }>;
  usage?: ChatUsage;
  error?: { message?: string; type?: string };
}

export interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function trimBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function chatEndpoint(baseUrl: string): string {
  return `${trimBaseUrl(baseUrl)}/chat/completions`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new LLMError('bad_response', 'Empty response from provider');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall-through */
      }
    }
    throw new LLMError('bad_response', 'Provider returned non-JSON output');
  }
}

function mapHttpError(status: number, message: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError('bad_key', 'Provider rejected the API key. Check Settings.');
  }
  if (status === 429) {
    return new LLMError('rate_limit', 'Provider rate limit hit. Wait a bit and retry.');
  }
  if (status >= 500) {
    return new LLMError('server', `Provider server error: ${message}`);
  }
  return new LLMError('server', `Provider error ${status}: ${message}`);
}

export async function callOpenAI(
  req: ShortenRequest,
  cfg: OpenAIConfig,
  signal?: AbortSignal,
): Promise<ShortenResult> {
  if (!cfg.baseUrl.trim()) {
    throw new LLMError('no_key', 'OpenAI-compatible base URL is not set.');
  }
  if (!cfg.model.trim()) {
    throw new LLMError('no_key', 'Model id is not set.');
  }

  const body = {
    model: cfg.model,
    temperature: 0.4,
    top_p: 0.9,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt(req.platform) },
      { role: 'user', content: buildUserMessage(req) },
    ],
  };

  let res: Response;
  try {
    res = await fetch(chatEndpoint(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    const msg = e instanceof Error ? e.message : 'network error';
    throw new LLMError('network', `Network error contacting provider: ${msg}`);
  }

  let json: ChatResponse;
  try {
    json = (await res.json()) as ChatResponse;
  } catch {
    throw new LLMError('bad_response', `Provider ${res.status}: non-JSON response`);
  }

  if (!res.ok) {
    throw mapHttpError(res.status, json.error?.message ?? res.statusText);
  }

  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new LLMError('bad_response', 'Provider returned no message content');

  const parsed = extractJson(text);
  const validation = validateShortenResponse(parsed, req.platform);
  if (!validation.ok) {
    throw new LLMError('bad_response', validation.reason);
  }

  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;

  return {
    ...validation.value,
    usage: {
      inputTokens,
      outputTokens,
      creditsConsumed: creditsFromTokens(inputTokens, outputTokens),
      fromCache: false,
    },
  };
}

/**
 * Sends one minimal chat call to the selected model, so a dead or misspelled
 * model id fails here instead of on the first LinkedIn post.
 */
export async function testOpenAIKey(cfg: OpenAIConfig): Promise<ProviderTestResult> {
  if (!cfg.baseUrl.trim()) return { ok: false, error: 'No base URL' };
  if (!cfg.model.trim()) return { ok: false, error: 'No model selected' };
  const started = Date.now();
  try {
    const res = await fetch(chatEndpoint(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: cfg.model.trim(),
        // Same JSON mode as the real call, so a model without it fails here.
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: 'Reply with this JSON: {"ok":true}' }],
        max_tokens: 16,
      }),
    });
    const latencyMs = Date.now() - started;
    let json: ChatResponse = {};
    try {
      json = (await res.json()) as ChatResponse;
    } catch {
      /* status alone is enough to report */
    }
    if (res.ok) return { ok: true, servedModel: json.model ?? cfg.model, latencyMs };
    const detail = json.error?.message?.split('\n')[0]?.slice(0, 160);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Key rejected by provider' };
    }
    if (res.status === 404) {
      return { ok: false, error: detail ? `Model unavailable: ${detail}` : 'Model or URL not found' };
    }
    return { ok: false, error: `Provider ${res.status}${detail ? `: ${detail}` : ''}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    return { ok: false, error: msg };
  }
}
