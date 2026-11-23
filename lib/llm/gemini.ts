import {
  LLMError,
  type ProviderTestResult,
  type ShortenRequest,
  type ShortenResult,
} from '@/lib/types';
import { creditsFromTokens } from '@/lib/credits/policy';
import { buildSystemPrompt, buildUserMessage } from './prompt';
import { validateShortenResponse } from './validator';

import { DEFAULT_GEMINI_MODEL } from './models';

const GEMINI_HOST = 'https://generativelanguage.googleapis.com';

export function geminiEndpoint(model: string): string {
  const id = (model.trim() || DEFAULT_GEMINI_MODEL).replace(/^models\//, '');
  return `${GEMINI_HOST}/v1beta/models/${encodeURIComponent(id)}:generateContent`;
}

/**
 * Shortening gains nothing from reasoning, and on flash models the default
 * thinking pass costs 2-3k extra tokens and ~12 s per call. Which setting
 * turns it down differs per model: 2.5 and 3.8 flash take budget 0, 3.5
 * flash-lite rejects budget 0 but takes a level, pro needs a level above
 * minimal. The 400 these answer is not always worded about thinking, so any
 * 400 that is not a key error steps down this ladder, and the step that
 * worked is remembered per model for the rest of the session.
 */
const THINKING_LADDER: Array<Record<string, unknown> | null> = [
  { thinkingBudget: 0 },
  { thinkingLevel: 'low' },
  null,
];
const thinkingStep = new Map<string, number>();

/**
 * First rung to try before anything is learned: 2.x models reject levels,
 * newer ones (and the -latest aliases, which point at 3.x) mostly accept
 * one. Starting right saves a wasted 400 per model in every LinkedIn tab.
 */
function initialThinkingStep(model: string): number {
  return /^gemini-2\./.test(model) ? 0 : 1;
}

function isKeyError(message: string): boolean {
  return /api key/i.test(message);
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
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
  modelVersion?: string;
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
  // An invalid key comes back as 400 with "API key not valid".
  if (status === 401 || status === 403 || (status === 400 && isKeyError(message))) {
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

interface GeminiCall {
  res: Response;
  json: GeminiResponse;
}

async function postGemini(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<GeminiCall> {
  const send = async (thinkingConfig: Record<string, unknown> | null): Promise<GeminiCall> => {
    const generationConfig = {
      ...((body.generationConfig as Record<string, unknown>) ?? {}),
      ...(thinkingConfig ? { thinkingConfig } : {}),
    };
    let res: Response;
    try {
      res = await fetch(geminiEndpoint(model), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify({ ...body, generationConfig }),
        signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      const msg = e instanceof Error ? e.message : 'network error';
      throw new LLMError('network', `Network error contacting Gemini: ${msg}`);
    }
    let json: GeminiResponse;
    try {
      json = (await res.json()) as GeminiResponse;
    } catch {
      throw new LLMError('bad_response', `Gemini ${res.status}: non-JSON response`);
    }
    return { res, json };
  };

  let step = thinkingStep.get(model) ?? initialThinkingStep(model);
  for (;;) {
    const call = await send(THINKING_LADDER[step]!);
    const retry =
      call.res.status === 400 &&
      !isKeyError(call.json.error?.message ?? '') &&
      step < THINKING_LADDER.length - 1;
    if (!retry) {
      if (call.res.ok) thinkingStep.set(model, step);
      return call;
    }
    step += 1;
  }
}

function answerText(json: GeminiResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

export async function callGemini(
  req: ShortenRequest,
  apiKey: string,
  model: string,
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

  const { res, json } = await postGemini(model, apiKey, body, signal);

  if (!res.ok) {
    throw mapHttpError(res.status, json.error?.message ?? res.statusText);
  }

  const text = answerText(json);
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

/**
 * Sends one minimal generate call to the selected model, so a dead or
 * misspelled model id fails here instead of on the first LinkedIn post.
 */
export async function testGeminiKey(apiKey: string, model: string): Promise<ProviderTestResult> {
  if (!apiKey.trim()) return { ok: false, error: 'No key provided' };
  const started = Date.now();
  try {
    const { res, json } = await postGemini(model, apiKey, {
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
      generationConfig: { maxOutputTokens: 16 },
    });
    const latencyMs = Date.now() - started;
    if (res.ok) {
      return { ok: true, servedModel: json.modelVersion ?? model, latencyMs };
    }
    const detail = json.error?.message?.split('\n')[0]?.slice(0, 160);
    if (res.status === 401 || res.status === 403 || isKeyError(detail ?? '')) {
      return { ok: false, error: 'Key rejected by Gemini' };
    }
    if (res.status === 404) {
      return { ok: false, error: detail ? `Model unavailable: ${detail}` : 'Model not found' };
    }
    return { ok: false, error: `Gemini ${res.status}${detail ? `: ${detail}` : ''}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'network error';
    return { ok: false, error: msg };
  }
}
