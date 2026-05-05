import { storage } from 'wxt/storage';
import type { DailyWindow, Stats } from '@/lib/types';
import { readingSeconds, timeSavedSeconds } from '@/lib/time/calculator';

const STATS_KEY = 'local:stats' as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const ROLLING_WINDOW_MS = 30 * DAY_MS;

function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function freshDaily(now: number = Date.now()): DailyWindow {
  return { dateIso: todayIso(now), creditsConsumed: 0, postsShortened: 0 };
}

export const DEFAULT_STATS: Stats = {
  postsShortened: 0,
  charsSaved: 0,
  readingSecondsSaved: 0,
  firstUseAt: 0,
  lastUseAt: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCreditsConsumed: 0,
  rollingWindow: { windowStart: 0, creditsConsumed: 0, postsShortened: 0 },
  daily: freshDaily(0),
};

const statsItem = storage.defineItem<Stats>(STATS_KEY, {
  fallback: DEFAULT_STATS,
  version: 1,
});

export async function getStats(): Promise<Stats> {
  const value = await statsItem.getValue();
  return { ...DEFAULT_STATS, ...value, daily: { ...DEFAULT_STATS.daily, ...value.daily } };
}

export async function setStats(next: Stats): Promise<void> {
  await statsItem.setValue(next);
}

export async function resetStats(): Promise<void> {
  await statsItem.setValue(DEFAULT_STATS);
}

export function watchStats(cb: (s: Stats) => void): () => void {
  return statsItem.watch((value) => cb({ ...DEFAULT_STATS, ...value }));
}

export function rolloverWindows(stats: Stats, now: number = Date.now()): Stats {
  const next: Stats = { ...stats };
  // Daily rollover.
  if (next.daily.dateIso !== todayIso(now)) {
    next.daily = freshDaily(now);
  }
  // 30-day rolling window reset if older than 30d.
  if (!next.rollingWindow.windowStart || now - next.rollingWindow.windowStart > ROLLING_WINDOW_MS) {
    next.rollingWindow = { windowStart: now, creditsConsumed: 0, postsShortened: 0 };
  }
  return next;
}

export function remainingDailyCredits(stats: Stats, cap: number, now: number = Date.now()): number {
  const refreshed = rolloverWindows(stats, now);
  return Math.max(0, cap - refreshed.daily.creditsConsumed);
}

export interface ApplyDelta {
  originalChars: number;
  appliedChars: number;
  original: string;
  applied: string;
}

export interface UsageDelta {
  inputTokens: number;
  outputTokens: number;
  credits: number;
  fromCache: boolean;
}

export async function recordShorten(
  apply: ApplyDelta,
  usage: UsageDelta,
  now: number = Date.now(),
): Promise<Stats> {
  const current = await getStats();
  const rolled = rolloverWindows(current, now);
  const seconds = timeSavedSeconds(apply.original, apply.applied);
  const savedChars = Math.max(0, apply.originalChars - apply.appliedChars);

  const next: Stats = {
    ...rolled,
    postsShortened: rolled.postsShortened + 1,
    charsSaved: rolled.charsSaved + savedChars,
    readingSecondsSaved: rolled.readingSecondsSaved + seconds,
    firstUseAt: rolled.firstUseAt || now,
    lastUseAt: now,
    totalInputTokens: rolled.totalInputTokens + (usage.fromCache ? 0 : usage.inputTokens),
    totalOutputTokens: rolled.totalOutputTokens + (usage.fromCache ? 0 : usage.outputTokens),
    totalCreditsConsumed: rolled.totalCreditsConsumed + (usage.fromCache ? 0 : usage.credits),
    rollingWindow: {
      ...rolled.rollingWindow,
      creditsConsumed: rolled.rollingWindow.creditsConsumed + (usage.fromCache ? 0 : usage.credits),
      postsShortened: rolled.rollingWindow.postsShortened + 1,
    },
    daily: {
      ...rolled.daily,
      creditsConsumed: rolled.daily.creditsConsumed + (usage.fromCache ? 0 : usage.credits),
      postsShortened: rolled.daily.postsShortened + 1,
    },
  };

  await setStats(next);
  return next;
}

export function readerMinutes(stats: Stats): number {
  return Math.round(stats.readingSecondsSaved / 60);
}

export { readingSeconds };
