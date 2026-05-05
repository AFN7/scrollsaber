import { storage } from 'wxt/storage';
import type { CacheEntry, Versions } from '@/lib/types';

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'local:shorten_cache:' as const;

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function keyFor(hash: string): `local:${string}` {
  return `${KEY_PREFIX}${hash}` as `local:${string}`;
}

export async function readCache(input: string): Promise<CacheEntry | null> {
  const hash = await sha256(input);
  const entry = await storage.getItem<CacheEntry>(keyFor(hash));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    await storage.removeItem(keyFor(hash));
    return null;
  }
  return entry;
}

export async function writeCache(
  input: string,
  versions: Versions,
  tokensUsed: { input: number; output: number },
): Promise<void> {
  const hash = await sha256(input);
  const now = Date.now();
  const entry: CacheEntry = {
    input,
    versions,
    tokensUsed,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  await storage.setItem<CacheEntry>(keyFor(hash), entry);
}

export async function clearCache(): Promise<number> {
  const all = await storage.snapshot('local');
  const keys = Object.keys(all).filter((k) => k.startsWith('shorten_cache:'));
  await Promise.all(keys.map((k) => storage.removeItem(`local:${k}` as `local:${string}`)));
  return keys.length;
}
