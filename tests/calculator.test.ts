import { describe, it, expect } from 'vitest';
import {
  countWords,
  readingSeconds,
  timeSavedSeconds,
  impactSeconds,
  formatDuration,
  formatMinutes,
} from '@/lib/time/calculator';

describe('countWords', () => {
  it('returns 0 for empty / whitespace input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t')).toBe(0);
  });

  it('counts whitespace-split tokens', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('one\n\ntwo\tthree   four')).toBe(4);
  });
});

describe('readingSeconds', () => {
  it('is 0 for empty text', () => {
    expect(readingSeconds('')).toBe(0);
  });

  it('matches 200 WPM baseline for round numbers', () => {
    const text = Array(200).fill('word').join(' ');
    expect(readingSeconds(text)).toBe(60);
  });

  it('rounds small inputs toward the nearest second', () => {
    // 20 words at 200 WPM = 6 seconds
    const text = Array(20).fill('word').join(' ');
    expect(readingSeconds(text)).toBe(6);
  });
});

describe('timeSavedSeconds', () => {
  it('returns the positive difference only', () => {
    const original = Array(400).fill('word').join(' '); // 120 s
    const shortened = Array(100).fill('word').join(' '); // 30 s
    expect(timeSavedSeconds(original, shortened)).toBe(90);
  });

  it('clamps negative deltas to zero', () => {
    expect(timeSavedSeconds('short', 'longer than the original by a wide margin indeed')).toBe(0);
  });
});

describe('impactSeconds', () => {
  it('multiplies per-viewer seconds by viewer count', () => {
    expect(impactSeconds(5, 100)).toBe(500);
  });

  it('defaults to 300 viewers', () => {
    expect(impactSeconds(1)).toBe(300);
  });

  it('never goes negative', () => {
    expect(impactSeconds(-5, 10)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats seconds-only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minute + seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats whole minutes cleanly', () => {
    expect(formatDuration(180)).toBe('3m');
  });

  it('formats hours', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('uses fallback for sub-second values', () => {
    expect(formatDuration(0)).toBe('a moment');
  });
});

describe('formatMinutes', () => {
  it('returns <1 for sub-minute values', () => {
    expect(formatMinutes(20)).toBe('<1');
  });

  it('rounds to nearest whole minute', () => {
    expect(formatMinutes(90)).toBe('2');
  });
});
