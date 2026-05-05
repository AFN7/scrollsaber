import type { Platform, ShortenResult, Versions } from '@/lib/types';

const PLATFORMS: Platform[] = ['linkedin', 'x', 'facebook', 'reddit', 'generic'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}

export interface ValidationSuccess {
  ok: true;
  value: Omit<ShortenResult, 'usage'>;
}

export function validateShortenResponse(
  raw: unknown,
  fallbackPlatform: Platform,
): ValidationFailure | ValidationSuccess {
  if (!isObject(raw)) return { ok: false, reason: 'Response is not a JSON object' };

  // Surface explicit errors from model.
  if (typeof raw.error === 'string' && raw.error.length > 0) {
    return {
      ok: true,
      value: {
        language_detected: (raw.language_detected === 'tr' ? 'tr' : 'en'),
        original_chars: typeof raw.original_chars === 'number' ? raw.original_chars : 0,
        platform_applied: fallbackPlatform,
        versions: { v75: '', v50: '', v25: '', v_one: '' },
        chars: { v75: 0, v50: 0, v25: 0, v_one: 0 },
        removed_elements: [],
        warnings: [],
        error: raw.error,
      },
    };
  }

  const versions = raw.versions;
  if (!isObject(versions)) return { ok: false, reason: 'Missing versions object' };

  const v75 = asStr(versions.v75);
  const v50 = asStr(versions.v50);
  const v25 = asStr(versions.v25);
  const vone = asStr(versions.v_one);
  if (!v75 && !v50 && !v25 && !vone) {
    return { ok: false, reason: 'All versions are empty' };
  }

  const parsed: Versions = { v75, v50, v25, v_one: vone };

  const charsRaw = isObject(raw.chars) ? raw.chars : {};
  const chars = {
    v75: typeof charsRaw.v75 === 'number' ? charsRaw.v75 : v75.length,
    v50: typeof charsRaw.v50 === 'number' ? charsRaw.v50 : v50.length,
    v25: typeof charsRaw.v25 === 'number' ? charsRaw.v25 : v25.length,
    v_one: typeof charsRaw.v_one === 'number' ? charsRaw.v_one : vone.length,
  };

  const platformFromModel = asStr(raw.platform_applied) as Platform;
  const platform_applied = PLATFORMS.includes(platformFromModel)
    ? platformFromModel
    : fallbackPlatform;

  return {
    ok: true,
    value: {
      language_detected: raw.language_detected === 'tr' ? 'tr' : 'en',
      original_chars:
        typeof raw.original_chars === 'number' ? raw.original_chars : 0,
      platform_applied,
      versions: parsed,
      chars,
      removed_elements: asStrArr(raw.removed_elements),
      warnings: asStrArr(raw.warnings),
      error: null,
    },
  };
}
