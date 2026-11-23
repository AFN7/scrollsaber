import {
  LLMError,
  type Provider,
  type ProviderTestResult,
  type ShortenRequest,
  type ShortenResult,
  type Settings,
} from '@/lib/types';
import { callGemini, testGeminiKey } from './gemini';
import { callOpenAI, testOpenAIKey, type OpenAIConfig } from './openai';
import { readCache, writeCache } from '@/lib/storage/cache';
import { creditsFromTokens } from '@/lib/credits/policy';
import { detectLanguageHint } from '@/lib/credits/estimator';
import { providerReady, activeModel } from '@/lib/storage/settings';

export interface ShortenOptions {
  signal?: AbortSignal;
  noCache?: boolean;
}

function openaiCfg(s: Settings): OpenAIConfig {
  return { baseUrl: s.openaiBaseUrl, apiKey: s.openaiApiKey, model: s.openaiModel };
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
    ? callGemini(req, settings.geminiApiKey, settings.geminiModel, signal)
    : callOpenAI(req, openaiCfg(settings), signal);
}

export async function shorten(
  req: ShortenRequest,
  settings: Settings,
  opts: ShortenOptions = {},
): Promise<ShortenResult> {
  // Provider and model are part of the key: switching model in Settings must
  // produce that model's output, not the previous one from cache.
  const cacheKey = JSON.stringify({
    provider: settings.provider,
    model: activeModel(settings, settings.provider),
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
    if (opts.signal?.aborted) throw err;
    const fallback = otherProvider(primary);
    const isRetryable =
      err instanceof LLMError && ['rate_limit', 'server', 'network'].includes(err.code);
    if (!isRetryable || !providerReady(settings, fallback)) throw err;

    try {
      result = await callProvider(fallback, req, settings, opts.signal);
    } catch {
      // The fallback is a second chance, not the user's choice: report why
      // the provider they picked failed.
      throw err;
    }
    result.warnings = [
      ...result.warnings,
      `${providerName(primary)} failed, answered by ${providerName(fallback)} (${activeModel(settings, fallback)})`,
    ];
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

function providerName(p: Provider): string {
  return p === 'gemini' ? 'Gemini' : 'OpenAI-compatible';
}

export async function testProvider(
  provider: Provider,
  settings: Settings,
): Promise<ProviderTestResult> {
  return provider === 'gemini'
    ? testGeminiKey(settings.geminiApiKey, settings.geminiModel)
    : testOpenAIKey(openaiCfg(settings));
}
