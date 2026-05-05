import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from '@/lib/llm/prompt';

describe('buildSystemPrompt', () => {
  it('includes only the requested platform block', () => {
    const linkedin = buildSystemPrompt('linkedin');
    expect(linkedin).toContain('PLATFORM: linkedin');
    expect(linkedin).not.toContain('PLATFORM: facebook');
    expect(linkedin).not.toContain('PLATFORM: reddit');
  });

  it('keeps reddit markdown rules for reddit', () => {
    const reddit = buildSystemPrompt('reddit');
    expect(reddit).toContain('PLATFORM: reddit');
    expect(reddit).toContain('Preserve Markdown');
  });

  it('keeps output format + self-check in every build', () => {
    for (const p of ['linkedin', 'x', 'facebook', 'reddit', 'generic'] as const) {
      const prompt = buildSystemPrompt(p);
      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('SELF-CHECK');
    }
  });

  it('is shorter than a monolithic all-platforms prompt would be', () => {
    const linkedin = buildSystemPrompt('linkedin');
    // Sanity check: under 5k chars means ~1200 tokens, well under the 3k tokens a
    // full multi-platform prompt would consume.
    expect(linkedin.length).toBeLessThan(5000);
  });
});

describe('buildUserMessage', () => {
  it('serializes all required fields', () => {
    const msg = buildUserMessage({
      platform: 'linkedin',
      language: 'auto',
      post: 'hello world',
      is_premium_x: false,
    });
    const parsed = JSON.parse(msg);
    expect(parsed.platform).toBe('linkedin');
    expect(parsed.language).toBe('auto');
    expect(parsed.post).toBe('hello world');
    expect(parsed.is_premium_x).toBe(false);
  });

  it('defaults is_premium_x to false', () => {
    const msg = buildUserMessage({
      platform: 'linkedin',
      language: 'auto',
      post: 'hi',
    });
    const parsed = JSON.parse(msg);
    expect(parsed.is_premium_x).toBe(false);
  });
});
