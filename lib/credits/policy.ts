export const TOKENS_PER_CREDIT = 1000;

export const POST_LENGTH_LIMITS = {
  HARD_MAX_CHARS: 30_000,
  CONFIRM_THRESHOLD_CHARS: 15_000,
  MIN_CHARS: 20,
} as const;

export const DEFAULT_DAILY_CREDIT_CAP = 50;

export const CREDIT_TIER_THRESHOLDS = {
  green: 3,
  yellow: 10,
} as const;

export function creditsFromTokens(inputTokens: number, outputTokens: number): number {
  const total = Math.max(0, inputTokens) + Math.max(0, outputTokens);
  return Math.ceil(total / TOKENS_PER_CREDIT);
}

export function creditTier(credits: number): 'green' | 'yellow' | 'red' {
  if (credits <= CREDIT_TIER_THRESHOLDS.green) return 'green';
  if (credits <= CREDIT_TIER_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

