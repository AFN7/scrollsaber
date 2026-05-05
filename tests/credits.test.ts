import { describe, it, expect } from 'vitest';
import {
  creditsFromTokens,
  creditTier,
  POST_LENGTH_LIMITS,
  TOKENS_PER_CREDIT,
} from '@/lib/credits/policy';
import { estimateCredits, detectLanguageHint } from '@/lib/credits/estimator';

describe('creditsFromTokens', () => {
  it('rounds up fractional credits', () => {
    expect(creditsFromTokens(500, 499)).toBe(1);
    expect(creditsFromTokens(500, 501)).toBe(2);
  });

  it('handles exact multiples', () => {
    expect(creditsFromTokens(TOKENS_PER_CREDIT, 0)).toBe(1);
    expect(creditsFromTokens(TOKENS_PER_CREDIT * 3, 0)).toBe(3);
  });

  it('treats negative inputs as zero', () => {
    expect(creditsFromTokens(-100, -100)).toBe(0);
  });
});

describe('creditTier', () => {
  it('classifies low cost as green', () => {
    expect(creditTier(1)).toBe('green');
    expect(creditTier(3)).toBe('green');
  });

  it('classifies medium cost as yellow', () => {
    expect(creditTier(4)).toBe('yellow');
    expect(creditTier(10)).toBe('yellow');
  });

  it('classifies heavy cost as red', () => {
    expect(creditTier(11)).toBe('red');
    expect(creditTier(99)).toBe('red');
  });
});

describe('POST_LENGTH_LIMITS', () => {
  it('exposes hard and soft limits', () => {
    expect(POST_LENGTH_LIMITS.HARD_MAX_CHARS).toBe(30_000);
    expect(POST_LENGTH_LIMITS.CONFIRM_THRESHOLD_CHARS).toBe(15_000);
    expect(POST_LENGTH_LIMITS.MIN_CHARS).toBe(20);
  });
});

describe('detectLanguageHint', () => {
  it('flags Turkish diacritics', () => {
    expect(detectLanguageHint('çğıöşü paylaşım')).toBe('tr');
    expect(detectLanguageHint('İstanbul\'dan selamlar')).toBe('tr');
  });

  it('falls back to English otherwise', () => {
    expect(detectLanguageHint('hello world')).toBe('en');
    expect(detectLanguageHint('')).toBe('en');
  });
});

describe('estimateCredits', () => {
  it('grows roughly linearly with post length', () => {
    const short = estimateCredits('a'.repeat(500), 'en');
    const long = estimateCredits('a'.repeat(5000), 'en');
    expect(long.credits).toBeGreaterThan(short.credits);
  });

  it('applies higher token ratio for Turkish', () => {
    const en = estimateCredits('a'.repeat(1000), 'en');
    const tr = estimateCredits('a'.repeat(1000), 'tr');
    expect(tr.inputTokens).toBeGreaterThan(en.inputTokens);
  });

  it('returns a tier matching credit bucket', () => {
    const small = estimateCredits('a'.repeat(200), 'en');
    expect(small.tier).toBe('green');
    const large = estimateCredits('a'.repeat(25000), 'en');
    expect(large.tier).toBe('red');
  });
});
