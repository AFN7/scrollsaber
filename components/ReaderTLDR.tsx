import * as React from 'react';
import { Swords, Loader2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Settings, ShortenResult, VersionKey } from '@/lib/types';
import { shorten } from '@/lib/llm/client';
import { LLMError } from '@/lib/types';
import {
  countWords,
  formatDuration,
  readingSeconds,
  timeSavedSeconds,
} from '@/lib/time/calculator';
import { recordShorten, remainingDailyCredits, getStats } from '@/lib/storage/stats';
import { creditsFromTokens } from '@/lib/credits/policy';

interface Props {
  text: string;
  settings: Settings;
  autoRun?: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: ShortenResult }
  | { kind: 'error'; message: string }
  | { kind: 'dismissed' };

const LENGTH_OPTIONS: Array<{ key: VersionKey; label: string }> = [
  { key: 'v_one', label: '1 sentence' },
  { key: 'v25', label: '25%' },
  { key: 'v50', label: '50%' },
  { key: 'v75', label: '75%' },
];

export function ReaderTLDR({ text, settings, autoRun = false }: Props) {
  const [state, setState] = React.useState<State>({ kind: 'idle' });
  const [selected, setSelected] = React.useState<VersionKey>('v_one');
  const fired = React.useRef(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const run = React.useCallback(async () => {
    if (fired.current) return;
    fired.current = true;

    const stats = await getStats();
    const remaining = remainingDailyCredits(stats, settings.dailyCreditCap);
    if (remaining < 2) {
      setState({ kind: 'error', message: 'Daily credit cap reached' });
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ kind: 'loading' });
    try {
      const result = await shorten(
        {
          platform: 'linkedin',
          language: settings.language,
          post: text,
          is_premium_x: false,
        },
        settings,
        { signal: ctrl.signal },
      );
      if (result.error) {
        setState({ kind: 'error', message: result.error });
        return;
      }
      const usage = result.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        creditsConsumed: creditsFromTokens(0, 0),
        fromCache: true,
      };
      await recordShorten(
        {
          original: text,
          applied: result.versions.v_one,
          originalChars: text.length,
          appliedChars: result.versions.v_one.length,
        },
        {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          credits: usage.creditsConsumed,
          fromCache: usage.fromCache,
        },
      );
      setState({ kind: 'ready', result });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const message =
        e instanceof LLMError ? e.message : e instanceof Error ? e.message : 'Unknown error';
      setState({ kind: 'error', message });
    }
  }, [text, settings]);

  React.useEffect(() => {
    if (autoRun && state.kind === 'idle') {
      run();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'dismissed') return null;

  const words = countWords(text);
  const readSec = readingSeconds(text);

  if (state.kind === 'idle') {
    return (
      <Shell>
        <button
          type="button"
          onClick={run}
          className="group flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[11.5px] font-medium text-neutral-400 transition-all duration-200 hover:border-[#FF3B3B]/40 hover:bg-[#FF3B3B]/[0.05] hover:text-neutral-100 hover:shadow-[0_0_18px_-6px_rgba(255,59,59,0.4)]"
        >
          <Swords
            className="h-3.5 w-3.5 text-[#FF3B3B] transition-transform duration-200 group-hover:scale-110"
            strokeWidth={2.4}
          />
          <span className="font-semibold tracking-[0.02em] text-neutral-200 group-hover:text-white">
            Scrollsaber
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-300 group-hover:text-neutral-100">TL;DR this post</span>
          <span className="ml-auto flex items-center gap-2 text-[10.5px] tabular-nums text-neutral-500 group-hover:text-neutral-400">
            <span>~{formatDuration(readSec)} read</span>
            <span className="text-neutral-700">·</span>
            <span>{words.toLocaleString()} words</span>
            <span className="text-neutral-700">·</span>
            <span>{text.length.toLocaleString()} chars</span>
          </span>
        </button>
      </Shell>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Shell>
        <div className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[11.5px] font-medium text-neutral-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF3B3B]" />
          <span className="font-semibold tracking-[0.02em]">Scrollsaber</span>
          <span className="text-neutral-600">·</span>
          <span>sharpening…</span>
        </div>
      </Shell>
    );
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <div className="flex w-full items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-[11.5px] font-medium text-amber-200/90">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{state.message}</span>
        </div>
      </Shell>
    );
  }

  const { versions } = state.result;
  const summary = versions[selected] ?? '';
  const saved = timeSavedSeconds(text, summary);
  const compression = Math.max(0, Math.round(100 - (summary.length / Math.max(text.length, 1)) * 100));

  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_1px_0_rgba(255,255,255,0.05)_inset,0_10px_30px_-14px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
          <Swords className="h-3.5 w-3.5 text-[#FF3B3B]" strokeWidth={2.4} />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-neutral-100">
            Scrollsaber
          </span>
          <span className="text-[10.5px] font-normal text-neutral-500">·</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-neutral-200">
            TL;DR
          </span>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-400">
            {saved > 0 && (
              <span className="tabular-nums text-neutral-300">
                saves ~{formatDuration(saved)}
              </span>
            )}
            {compression > 0 && (
              <span className="rounded-md bg-[#FF3B3B]/[0.14] px-1.5 py-[2px] text-[10.5px] font-semibold tabular-nums text-[#FF5C5C] shadow-[inset_0_0_0_1px_rgba(255,92,92,0.22)]">
                −{compression}%
              </span>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setState({ kind: 'dismissed' })}
              className="ml-0.5 rounded p-0.5 text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="whitespace-pre-wrap px-4 pb-3.5 text-[14.5px] leading-[1.55] text-neutral-50">
          {summary}
        </p>

        <div className="flex items-center gap-1 bg-white/[0.02] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Length
          </span>
          {LENGTH_OPTIONS.map((opt) => {
            const active = selected === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSelected(opt.key)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                  active
                    ? 'bg-[#FF3B3B]/[0.16] text-[#FF6A6A] shadow-[inset_0_0_0_1px_rgba(255,106,106,0.32)]'
                    : 'text-neutral-300 hover:bg-white/[0.07] hover:text-neutral-50',
                )}
              >
                {opt.label}
              </button>
            );
          })}
          <span className="ml-auto text-[11px] tabular-nums text-neutral-400">
            {text.length.toLocaleString()} → {summary.length.toLocaleString()}
          </span>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="scrollsaber-root my-2">{children}</div>;
}

