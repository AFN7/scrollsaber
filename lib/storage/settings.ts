import { storage } from 'wxt/storage';
import type { Settings } from '@/lib/types';
import { DEFAULT_DAILY_CREDIT_CAP } from '@/lib/credits/policy';
import { OPENAI_PRESETS } from '@/lib/llm/presets';

const SETTINGS_KEY = 'local:settings' as const;

const GROQ_PRESET = OPENAI_PRESETS.find((p) => p.id === 'groq')!;

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
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

export async function getSettings(): Promise<Settings> {
  const value = await settingsItem.getValue();
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...partial };
  await settingsItem.setValue(next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void): () => void {
  return settingsItem.watch((value) => cb({ ...DEFAULT_SETTINGS, ...value }));
}

export function hasApiKey(s: Settings): boolean {
  if (s.provider === 'gemini') return s.geminiApiKey.trim().length > 0;
  return s.openaiBaseUrl.trim().length > 0 && s.openaiModel.trim().length > 0;
}
