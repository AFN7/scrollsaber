import { storage } from 'wxt/storage';
import type { Provider, Settings } from '@/lib/types';
import { DEFAULT_DAILY_CREDIT_CAP } from '@/lib/credits/policy';
import { OPENAI_PRESETS, RETIRED_PRESET_MODELS } from '@/lib/llm/presets';
import { DEFAULT_GEMINI_MODEL } from '@/lib/llm/models';

const SETTINGS_KEY = 'local:settings' as const;

const GROQ_PRESET = OPENAI_PRESETS.find((p) => p.id === 'groq')!;

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  openaiBaseUrl: GROQ_PRESET.baseUrl,
  openaiApiKey: '',
  openaiModel: GROQ_PRESET.defaultModel,
  openaiPreset: GROQ_PRESET.id,
  language: 'auto',
  accentColor: 'red',
  dailyCreditCap: DEFAULT_DAILY_CREDIT_CAP,
  onboarded: false,
  readerMode: true,
  readerMinChars: 100,
};

interface LegacyV1Settings {
  provider?: 'gemini' | 'groq';
  apiKey?: string;
  groqApiKey?: string;
  [k: string]: unknown;
}

const settingsItem = storage.defineItem<Settings>(SETTINGS_KEY, {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    2: (old: unknown): Settings => {
      const o = (old ?? {}) as LegacyV1Settings;
      return {
        ...DEFAULT_SETTINGS,
        ...(o as Partial<Settings>),
        provider: o.provider === 'groq' ? 'openai' : (o.provider ?? 'gemini'),
        geminiApiKey: typeof o.apiKey === 'string' ? o.apiKey : DEFAULT_SETTINGS.geminiApiKey,
        openaiApiKey:
          typeof o.groqApiKey === 'string' ? o.groqApiKey : DEFAULT_SETTINGS.openaiApiKey,
        openaiBaseUrl: GROQ_PRESET.baseUrl,
        openaiModel: GROQ_PRESET.defaultModel,
        openaiPreset: GROQ_PRESET.id,
      };
    },
  },
});

/**
 * Fill fields added after the stored copy was written, and move preset
 * default models the provider has since retired onto the preset's current
 * default. A model the user typed by hand is never touched.
 */
function normalize(value: Partial<Settings> | null | undefined): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, ...(value ?? {}) };
  if (!s.geminiModel.trim()) s.geminiModel = DEFAULT_GEMINI_MODEL;
  const replacement = RETIRED_PRESET_MODELS[`${s.openaiPreset}:${s.openaiModel}`];
  if (replacement) s.openaiModel = replacement;
  return s;
}

export async function getSettings(): Promise<Settings> {
  return normalize(await settingsItem.getValue());
}

export async function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...partial };
  await settingsItem.setValue(next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return settingsItem.watch((value) => cb(normalize(value)));
}

/** A provider is usable once it has a key and, for OpenAI-compatible, a URL and model. */
export function providerReady(s: Settings, p: Provider): boolean {
  if (p === 'gemini') return s.geminiApiKey.trim().length > 0;
  return (
    s.openaiApiKey.trim().length > 0 &&
    s.openaiBaseUrl.trim().length > 0 &&
    s.openaiModel.trim().length > 0
  );
}

export function hasApiKey(s: Settings): boolean {
  return providerReady(s, s.provider);
}

export function activeModel(s: Settings, p: Provider = s.provider): string {
  return p === 'gemini' ? s.geminiModel.trim() || DEFAULT_GEMINI_MODEL : s.openaiModel.trim();
}
