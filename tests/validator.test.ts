import { describe, it, expect } from 'vitest';
import { validateShortenResponse } from '@/lib/llm/validator';

const goodPayload = {
  language_detected: 'en',
  original_chars: 200,
  platform_applied: 'linkedin',
  versions: {
    v75: 'seventy-five percent output goes here for the preview',
    v50: 'halfway down',
    v25: 'quarter cut',
    v_one: 'one sentence',
  },
  chars: { v75: 55, v50: 12, v25: 11, v_one: 12 },
  removed_elements: ['filler opener'],
  warnings: [],
  error: null,
};

describe('validateShortenResponse', () => {
  it('accepts a well-formed response', () => {
    const out = validateShortenResponse(goodPayload, 'linkedin');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.versions.v75).toMatch(/seventy-five/);
      expect(out.value.platform_applied).toBe('linkedin');
    }
  });

  it('rejects non-object input', () => {
    expect(validateShortenResponse('not json', 'linkedin').ok).toBe(false);
    expect(validateShortenResponse(null, 'linkedin').ok).toBe(false);
  });

  it('rejects response with no versions', () => {
    const out = validateShortenResponse(
      { ...goodPayload, versions: { v75: '', v50: '', v25: '', v_one: '' } },
      'linkedin',
    );
    expect(out.ok).toBe(false);
  });

  it('falls back to request platform if model returns unknown platform', () => {
    const out = validateShortenResponse(
      { ...goodPayload, platform_applied: 'bogus' },
      'linkedin',
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.platform_applied).toBe('linkedin');
  });

  it('surfaces explicit model errors without blowing up', () => {
    const out = validateShortenResponse(
      { error: 'post too short', versions: null },
      'linkedin',
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.error).toBe('post too short');
  });

  it('defaults char counts from version length when missing', () => {
    const out = validateShortenResponse(
      { ...goodPayload, chars: undefined },
      'linkedin',
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.chars.v75).toBe(goodPayload.versions.v75.length);
    }
  });
});
