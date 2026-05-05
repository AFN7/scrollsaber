export type Platform =
  | 'linkedin'
  | 'x'
  | 'facebook'
  | 'reddit'
  | 'generic';

export type Language = 'tr' | 'en' | 'auto';
export type DetectedLanguage = 'tr' | 'en';

export type VersionKey = 'v75' | 'v50' | 'v25' | 'v_one';

export type Versions = Record<VersionKey, string>;

export interface ShortenRequest {
  platform: Platform;
  language: Language;
  post: string;
  is_premium_x?: boolean;
}

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  creditsConsumed: number;
  fromCache: boolean;
}

export interface ShortenResult {
  language_detected: DetectedLanguage;
  original_chars: number;
  platform_applied: Platform;
  versions: Versions;
  chars: Record<VersionKey, number>;
  removed_elements: string[];
  warnings: string[];
  error: string | null;
  usage?: UsageMetadata;
}

export interface CreditEstimate {
  inputTokens: number;
  outputTokens: number;
  credits: number;
  tier: 'green' | 'yellow' | 'red';
}

export type Provider = 'gemini' | 'openai';
export type AccentColor = 'red' | 'blue';

export interface Settings {
  provider: Provider;
  /** Gemini API key (Google AI Studio). */
  geminiApiKey: string;
  /** OpenAI-compatible base URL (Groq, OpenRouter, DeepSeek, etc.). No trailing slash. */
  openaiBaseUrl: string;
  /** API key for the OpenAI-compatible endpoint. */
  openaiApiKey: string;
  /** Model id for the OpenAI-compatible endpoint. */
  openaiModel: string;
  /** Active preset id for UI hints (e.g. 'groq', 'openrouter', 'custom'). */
  openaiPreset: string;
  language: Language;
  accentColor: AccentColor;
  dailyCreditCap: number;
  onboarded: boolean;
  /** Auto-TL;DR on feed posts. */
  readerMode: boolean;
  /** Only auto-summarize posts at or above this many chars. */
  readerMinChars: number;
}

export interface DailyWindow {
  dateIso: string;
  creditsConsumed: number;
  postsShortened: number;
}

export interface RollingWindow {
  windowStart: number;
  creditsConsumed: number;
  postsShortened: number;
}

export interface Stats {
  postsShortened: number;
  charsSaved: number;
  readingSecondsSaved: number;
  firstUseAt: number;
  lastUseAt: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCreditsConsumed: number;
  rollingWindow: RollingWindow;
  daily: DailyWindow;
}

export interface CacheEntry {
  input: string;
  versions: Versions;
  tokensUsed: { input: number; output: number };
  createdAt: number;
  expiresAt: number;
}

export interface LLMProvider {
  shorten(req: ShortenRequest): Promise<ShortenResult>;
  testKey(): Promise<{ ok: boolean; error?: string }>;
}

export type LLMErrorCode =
  | 'no_key'
  | 'bad_key'
  | 'rate_limit'
  | 'network'
  | 'server'
  | 'bad_response'
  | 'daily_limit'
  | 'too_long'
  | 'too_short';

export class LLMError extends Error {
  code: LLMErrorCode;
  constructor(code: LLMErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LLMError';
  }
}
