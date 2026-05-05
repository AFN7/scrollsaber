import {
  LLMError,
  type Provider,
  type ShortenRequest,
  type ShortenResult,
  type Settings,
} from '@/lib/types';
import { callGemini, testGeminiKey } from './gemini';
import { callOpenAI, testOpenAIKey, type OpenAIConfig } from './openai';
import { readCache, writeCache } from '@/lib/storage/cache';
import { creditsFromTokens } from '@/lib/credits/policy';
import { detectLanguageHint } from '@/lib/credits/estimator';

export interface ShortenOptions {
  signal?: AbortSignal;
  noCache?: boolean;
}

function openaiCfg(s: Settings): OpenAIConfig {
  return { baseUrl: s.openaiBaseUrl, apiKey: s.openaiApiKey, model: s.openaiModel };
}

function providerReady(s: Settings, p: Provider): boolean {
  if (p === 'gemini') return s.geminiApiKey.trim().length > 0;
  return s.openaiBaseUrl.trim().length > 0 && s.openaiModel.trim().length > 0;
}

function otherProvider(p: Provider): Provider {
  return p === 'gemini' ? 'openai' : 'gemini';
}

async function callProvider(
  provider: Provider,
  req: ShortenRequest,
  settings: Settings,
  signal?: AbortSignal,
): Promise<ShortenResult> {
  return provider === 'gemini'
    ? callGemini(req, settings.geminiApiKey, signal)
    : callOpenAI(req, openaiCfg(settings), signal);
}

export async function shorten(
  req: ShortenRequest,
  settings: Settings,
  opts: ShortenOptions = {},
): Promise<ShortenResult> {
  const cacheKey = JSON.stringify({
    post: req.post,
    platform: req.platform,
    language: req.language,
    is_premium_x: req.is_premium_x ?? false,
  });

  if (!opts.noCache) {
    const hit = await readCache(cacheKey);
    if (hit) {
      return {
        language_detected: detectLanguageHint(req.post),
        original_chars: req.post.length,
        platform_applied: req.platform,
        versions: hit.versions,
        chars: {
          v75: hit.versions.v75.length,
          v50: hit.versions.v50.length,
          v25: hit.versions.v25.length,
          v_one: hit.versions.v_one.length,
        },
        removed_elements: [],
        warnings: ['Served from local cache'],
        error: null,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          creditsConsumed: 0,
          fromCache: true,
        },
      };
    }
  }

  const primary = settings.provider;
  if (!providerReady(settings, primary)) {
    throw new LLMError('no_key', 'No API key for the selected provider.');
  }

  let result: ShortenResult;
  try {
    result = await callProvider(primary, req, settings, opts.signal);
  } catch (err) {
    const fallback = otherProvider(primary);
    const isRetryable =
      err instanceof LLMError && ['rate_limit', 'server', 'network'].includes(err.code);
    if (!isRetryable || !providerReady(settings, fallback)) throw err;

    result = await callProvider(fallback, req, settings, opts.signal);
    result.warnings = [...result.warnings, `Primary (${primary}) failed — used ${fallback}`];
    result.usage = result.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      creditsConsumed: creditsFromTokens(0, 0),
      fromCache: false,
    };
  }

  if (!opts.noCache && result.versions.v75) {
    await writeCache(cacheKey, result.versions, {
      input: result.usage?.inputTokens ?? 0,
      output: result.usage?.outputTokens ?? 0,
    });
  }
  return result;
}

export async function testProvider(
  provider: Provider,
  settings: Settings,
): Promise<{ ok: boolean; error?: string }> {
  return provider === 'gemini'
    ? testGeminiKey(settings.geminiApiKey)
    : testOpenAIKey(openaiCfg(settings));
}
