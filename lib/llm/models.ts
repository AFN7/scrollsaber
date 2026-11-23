/**
 * Model catalogs for the Settings picker.
 *
 * Gemini's list endpoint carries no prices, so tiers come from the model
 * family name (flash-lite < flash < pro). OpenAI-compatible catalogs that do
 * publish per-token prices (OpenRouter, Cerebras) are tiered by the cost of
 * one typical shortening call; the rest are listed without a tier.
 */

/**
 * The cheapest Gemini model that handles the prompt: about a fifth of the
 * per-post price of the 3.x flash-lite ids, and the model the extension has
 * always used, so existing installs keep their behaviour. The newer lite
 * models hold the length limits more tightly; users can pick them.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export type ModelTier = 'free' | 'cheap' | 'standard' | 'premium' | 'unknown';

export interface ModelOption {
  id: string;
  tier: ModelTier;
  /** Estimated USD per shortening call, when the provider publishes prices. */
  costPerPost?: number;
}

export const TIER_LABELS: Record<ModelTier, string> = {
  free: 'Free',
  cheap: 'Cheapest',
  standard: 'Balanced',
  premium: 'Premium (slower, costs more)',
  unknown: 'Other',
};

export const TIER_ORDER: ModelTier[] = ['free', 'cheap', 'standard', 'premium', 'unknown'];

/**
 * Token shape of one shortening call (system prompt + a ~1,500 char post in,
 * four versions out), measured against gemini-2.5-flash-lite.
 */
const TYPICAL_INPUT_TOKENS = 1200;
const TYPICAL_OUTPUT_TOKENS = 700;

/** Per-post cost boundaries between tiers, in USD. */
const CHEAP_MAX_PER_POST = 0.001;
const STANDARD_MAX_PER_POST = 0.01;

export class ModelListError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ModelListError';
    this.status = status;
  }
}

// ---------------------------------------------------------------- Gemini

interface GeminiModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
}

/**
 * Gemini models listed with generateContent that still cannot serve this
 * call: media generators, speech, agents, and families that need another API
 * or return thought text in the answer part (Gemma, Omni).
 */
const GEMINI_EXCLUDE =
  /(tts|image|banana|lyria|robotics|computer-use|transcribe|embedding|aqa|audio|live|customtools|omni)/i;

export function geminiTier(id: string): ModelTier {
  if (/flash-lite|flash_lite/i.test(id)) return 'cheap';
  if (/pro/i.test(id)) return 'premium';
  if (/flash/i.test(id)) return 'standard';
  return 'unknown';
}

export function parseGeminiModels(entries: GeminiModelEntry[]): ModelOption[] {
  const out: ModelOption[] = [];
  for (const e of entries) {
    const id = (e.name ?? '').replace(/^models\//, '');
    if (!id.startsWith('gemini-')) continue;
    if (!e.supportedGenerationMethods?.includes('generateContent')) continue;
    if (GEMINI_EXCLUDE.test(id)) continue;
    out.push({ id, tier: geminiTier(id) });
  }
  return sortOptions(out);
}

export async function listGeminiModels(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const entries: GeminiModelEntry[] = [];
  let pageToken = '';
  // The API pages at 1000; loop anyway so a longer catalog is not cut off.
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal });
    if (!res.ok) throw new ModelListError(listErrorMessage('Gemini', res.status), res.status);
    const json = (await res.json()) as { models?: GeminiModelEntry[]; nextPageToken?: string };
    entries.push(...(json.models ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return parseGeminiModels(entries);
}

// ------------------------------------------------------ OpenAI-compatible

interface OpenAIModelEntry {
  id?: string;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: { output_modalities?: string[]; modality?: string };
  supported_parameters?: unknown;
}

/**
 * Ids that cannot serve this call: speech, embeddings, moderation, image and
 * music generators, and OpenRouter's `:batch` variants (async, not realtime).
 */
const OPENAI_EXCLUDE =
  /(whisper|tts|embed|guard|moderation|dall-e|image|audio|transcribe|rerank|playai|orpheus|lyria|:batch$)/i;

function toNumber(v: string | number | undefined): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function costTier(costPerPost: number | undefined): ModelTier {
  if (costPerPost === undefined) return 'unknown';
  if (costPerPost === 0) return 'free';
  if (costPerPost <= CHEAP_MAX_PER_POST) return 'cheap';
  if (costPerPost <= STANDARD_MAX_PER_POST) return 'standard';
  return 'premium';
}

/** OpenRouter lists params as an array; keep the model only if it takes JSON mode. */
function acceptsJsonMode(e: OpenAIModelEntry): boolean {
  const p = e.supported_parameters;
  if (!Array.isArray(p)) return true;
  return p.includes('response_format') || p.includes('structured_outputs');
}

function outputsText(e: OpenAIModelEntry): boolean {
  const out = e.architecture?.output_modalities;
  if (Array.isArray(out)) return out.includes('text');
  const modality = e.architecture?.modality;
  if (typeof modality === 'string' && modality.includes('->')) return modality.endsWith('text');
  return true;
}

export function parseOpenAIModels(payload: unknown): ModelOption[] {
  const list: OpenAIModelEntry[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: OpenAIModelEntry[] }).data
      : [];
  const out: ModelOption[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    const id = typeof e.id === 'string' ? e.id.trim() : '';
    if (!id || seen.has(id)) continue;
    if (OPENAI_EXCLUDE.test(id) || !outputsText(e) || !acceptsJsonMode(e)) continue;
    seen.add(id);
    const prompt = toNumber(e.pricing?.prompt);
    const completion = toNumber(e.pricing?.completion);
    const costPerPost =
      prompt !== undefined && completion !== undefined
        ? prompt * TYPICAL_INPUT_TOKENS + completion * TYPICAL_OUTPUT_TOKENS
        : undefined;
    out.push({ id, tier: costTier(costPerPost), costPerPost });
  }
  return sortOptions(out);
}

export async function listOpenAIModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelOption[]> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new ModelListError('Set a base URL first');
  const res = await fetch(`${base}/models`, {
    headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
    signal,
  });
  if (!res.ok) throw new ModelListError(listErrorMessage('Provider', res.status), res.status);
  return parseOpenAIModels(await res.json());
}

// ---------------------------------------------------------------- shared

function listErrorMessage(who: string, status: number): string {
  if (status === 401 || status === 403) return `${who} rejected the key`;
  if (status === 404) return `${who} has no model list at this URL`;
  if (status === 429) return `${who} rate limit, try again shortly`;
  return `${who} answered ${status}`;
}

function sortOptions(list: ModelOption[]): ModelOption[] {
  return list.sort((a, b) => {
    const t = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    if (t !== 0) return t;
    if (a.costPerPost !== undefined && b.costPerPost !== undefined && a.costPerPost !== b.costPerPost) {
      return a.costPerPost - b.costPerPost;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * The model the "use recommended" shortcut picks. A preferred id (the
 * provider's preset default) wins when the catalog has it, because the
 * lowest price alone tends to land on tiny models nobody has run this prompt
 * on. Without one, the cheapest non-preview option by published price.
 */
export function recommendedOption(list: ModelOption[], preferredId?: string): ModelOption | undefined {
  if (preferredId) {
    const hit = list.find((m) => m.id === preferredId);
    if (hit) return hit;
  }
  const ranked = list.filter((m) => m.tier === 'cheap' || m.tier === 'free');
  // Free OpenRouter models are rate limited and churn; prefer the cheapest paid
  // one when it exists, otherwise fall back to free.
  const pool = ranked.some((m) => m.tier === 'cheap')
    ? ranked.filter((m) => m.tier === 'cheap')
    : ranked;
  const stable = pool.filter((m) => !/preview|experimental|exp-/i.test(m.id));
  return stable[0] ?? pool[0];
}

export function formatCostPerPost(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.0001) return '<$0.0001/post';
  if (usd < 0.01) return `$${usd.toFixed(4)}/post`;
  return `$${usd.toFixed(3)}/post`;
}
