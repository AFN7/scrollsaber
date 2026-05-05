import { LLMError, type ShortenRequest, type ShortenResult } from '@/lib/types';
import { creditsFromTokens } from '@/lib/credits/policy';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { validateShortenResponse } from './validator';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  error?: { message?: string; code?: number; status?: string };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new LLMError('bad_response', 'Empty response from Gemini');
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
    throw new LLMError('bad_response', 'Gemini returned non-JSON output');
  }
}

function mapHttpError(status: number, message: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError('bad_key', 'Gemini rejected the API key. Check Settings.');
  }
  if (status === 429) {
    return new LLMError('rate_limit', 'Gemini rate limit hit. Wait a bit and retry.');
  }
  if (status >= 500) {
    return new LLMError('server', `Gemini server error: ${message}`);
  }
  return new LLMError('server', `Gemini error ${status}: ${message}`);
}

export async function callGemini(
  req: ShortenRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ShortenResult> {
  if (!apiKey.trim()) {
    throw new LLMError('no_key', 'Gemini API key is not set.');
  }
  const body = {
    systemInstruction: { role: 'system', parts: [{ text: buildSystemPrompt(req.platform) }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserMessage(req) }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  };

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    throw new LLMError('network', `Network error contacting Gemini: ${msg}`);
  }

  let json: GeminiResponse;
  try {
    json = (await res.json()) as GeminiResponse;
  } catch {
    throw new LLMError('bad_response', `Gemini ${res.status}: non-JSON response`);
  }

  if (!res.ok) {
    throw mapHttpError(res.status, json.error?.message ?? res.statusText);
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new LLMError('bad_response', 'Gemini returned no text parts');

  const parsed = extractJson(text);
  const validation = validateShortenResponse(parsed, req.platform);
  if (!validation.ok) {
    throw new LLMError('bad_response', validation.reason);
  }

  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

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

export async function testGeminiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey.trim()) return { ok: false, error: 'No key provided' };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' },
    );
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Key rejected by Gemini' };
    }
    return { ok: false, error: `Gemini responded ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    return { ok: false, error: msg };
  }
}
