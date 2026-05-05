import type { CreditEstimate, DetectedLanguage } from '@/lib/types';
import { TOKENS_PER_CREDIT, creditTier } from './policy';

const CHARS_PER_TOKEN: Record<DetectedLanguage, number> = {
  tr: 2.5,
  en: 3.5,
};

const SYSTEM_PROMPT_TOKENS = 800;
const OUTPUT_RATIO = 0.8;

export function detectLanguageHint(text: string): DetectedLanguage {
  if (!text) return 'en';
  // Quick heuristic; the LLM is the real detector. Turkish-specific letters.
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/.test(text);
  if (turkishChars) return 'tr';
  return 'en';
}

export function estimateTokens(post: string, language: DetectedLanguage): {
  inputTokens: number;
  outputTokens: number;
} {
  const chars = post.length;
  const ratio = CHARS_PER_TOKEN[language];
  const inputTokens = Math.ceil(chars / ratio) + SYSTEM_PROMPT_TOKENS;
  const outputTokens = Math.ceil(inputTokens * OUTPUT_RATIO);
  return { inputTokens, outputTokens };
}

export function estimateCredits(
  post: string,
  language: DetectedLanguage = detectLanguageHint(post),
): CreditEstimate {
  const { inputTokens, outputTokens } = estimateTokens(post, language);
  const credits = Math.ceil((inputTokens + outputTokens) / TOKENS_PER_CREDIT);
  return {
    inputTokens,
    outputTokens,
    credits,
    tier: creditTier(credits),
  };
}
