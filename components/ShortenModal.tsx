import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VersionSlider } from './VersionSlider';
import { PreviewPanel } from './PreviewPanel';
import { CreditEstimateBadge } from './CreditEstimateBadge';
import { TimeSavedToastBody } from './TimeSavedToast';
import type {
  Platform,
  Settings,
  ShortenResult,
  VersionKey,
  Versions,
} from '@/lib/types';
import { LLMError } from '@/lib/types';
import { shorten } from '@/lib/llm/client';
import {
  POST_LENGTH_LIMITS,
  creditsFromTokens,
} from '@/lib/credits/policy';
import { estimateCredits, detectLanguageHint } from '@/lib/credits/estimator';
import { recordShorten, remainingDailyCredits, getStats } from '@/lib/storage/stats';
import { impactSeconds, timeSavedSeconds } from '@/lib/time/calculator';
import { Loader2, RotateCcw, AlertTriangle, Swords } from 'lucide-react';

type Phase =
  | { kind: 'idle' }
  | { kind: 'confirm-long' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: ShortenResult }
  | { kind: 'error'; message: string; code?: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  platform?: Platform;
  settings: Settings;
  onApply: (text: string, versions: Versions, appliedKey: VersionKey) => void;
}

const PLATFORM_DEFAULT: Platform = 'linkedin';

export function ShortenModal({
  open,
  onOpenChange,
  originalText,
  platform = PLATFORM_DEFAULT,
  settings,
  onApply,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' });
  const [selected, setSelected] = React.useState<VersionKey>('v50');
  const abortRef = React.useRef<AbortController | null>(null);

  const detected = React.useMemo(() => detectLanguageHint(originalText), [originalText]);
  const estimate = React.useMemo(
    () => estimateCredits(originalText, detected),
    [originalText, detected],
  );

  const trimmedLen = originalText.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < POST_LENGTH_LIMITS.MIN_CHARS;
  const tooLong = originalText.length > POST_LENGTH_LIMITS.HARD_MAX_CHARS;
  const needsConfirm =
    !tooLong && originalText.length > POST_LENGTH_LIMITS.CONFIRM_THRESHOLD_CHARS;

  // Reset state when reopened on new text.
  React.useEffect(() => {
    if (open) {
      setPhase({ kind: 'idle' });
      setSelected('v50');
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open, originalText]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function runShorten(skipConfirm: boolean) {
    if (tooLong) {
      setPhase({
        kind: 'error',
        code: 'too_long',
        message: `This post is ${originalText.length.toLocaleString()} chars — over the ${POST_LENGTH_LIMITS.HARD_MAX_CHARS.toLocaleString()} limit. Split it first.`,
      });
      return;
    }
    if (tooShort) {
      setPhase({
        kind: 'error',
        code: 'too_short',
        message: `This post is only ${trimmedLen} chars — already concise.`,
      });
      return;
    }
    if (!skipConfirm && needsConfirm) {
      setPhase({ kind: 'confirm-long' });
      return;
    }

    // Daily credit cap check (v1 BYOK, enforced locally).
    const stats = await getStats();
    const remaining = remainingDailyCredits(stats, settings.dailyCreditCap);
    if (estimate.credits > remaining) {
      setPhase({
        kind: 'error',
        code: 'daily_limit',
        message: `Daily cap: ${remaining}/${settings.dailyCreditCap} credits left, this post needs ~${estimate.credits}. Raise the cap in Settings or wait for reset.`,
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'loading' });

    try {
      const result = await shorten(
        {
          platform,
          language: settings.language,
          post: originalText,
          is_premium_x: false,
        },
        settings,
        { signal: controller.signal },
      );
      if (result.error) {
        setPhase({ kind: 'error', message: result.error });
        return;
      }
      setPhase({ kind: 'ready', result });
      // Pick best starting version based on original length.
      const preferred: VersionKey =
        originalText.length > 800 ? 'v50' : originalText.length > 300 ? 'v75' : 'v25';
      setSelected(preferred);
    } catch (e) {
      if (controller.signal.aborted) return;
      const message =
        e instanceof LLMError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Unknown error';
      const code = e instanceof LLMError ? e.code : undefined;
      setPhase({ kind: 'error', message, code });
    }
  }

  async function handleApply() {
    if (phase.kind !== 'ready') return;
    const text = phase.result.versions[selected];
    if (!text) return;

    const usage = phase.result.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      creditsConsumed: creditsFromTokens(0, 0),
      fromCache: true,
    };
    await recordShorten(
      {
        original: originalText,
        applied: text,
        originalChars: originalText.length,
        appliedChars: text.length,
      },
      {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        credits: usage.creditsConsumed,
        fromCache: usage.fromCache,
      },
    );
    onApply(text, phase.result.versions, selected);
    onOpenChange(false);
  }

  function handleCancel() {
    abortRef.current?.abort();
    onOpenChange(false);
  }

  const versions: Versions =
    phase.kind === 'ready'
      ? phase.result.versions
      : { v75: '', v50: '', v25: '', v_one: '' };

  const previewText = versions[selected] ?? '';
  const previewChars = previewText.length;
  const timePerReader = timeSavedSeconds(originalText, previewText);

  return (
    // modal={false} disables Radix's scroll-lock (which was cancelling mouse-wheel
    // events across the shadow-DOM boundary). We then have to explicitly block
    // the outside-interaction auto-close, otherwise the button click that opens
    // the dialog is itself interpreted as an outside pointerdown and closes it.
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="scrollsaber-root"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Swords className="h-5 w-5 text-[#FF3B3B]" strokeWidth={2.4} />
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-neutral-50">
              Scrollsaber
            </DialogTitle>
            <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              {platform}
            </span>
            <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              {detected}
            </span>
          </div>
          <DialogDescription className="text-[13px] text-neutral-400">
            Pick a length. The scalpel keeps the point.
          </DialogDescription>
        </DialogHeader>

        {phase.kind === 'idle' && (
          <IdleView
            original={originalText}
            creditsNeeded={estimate.credits}
            tooShort={tooShort}
            tooLong={tooLong}
            needsConfirm={needsConfirm}
            onRun={() => runShorten(false)}
          />
        )}

        {phase.kind === 'confirm-long' && (
          <ConfirmLongView
            chars={originalText.length}
            credits={estimate.credits}
            onCancel={() => setPhase({ kind: 'idle' })}
            onConfirm={() => runShorten(true)}
          />
        )}

        {phase.kind === 'loading' && <LoadingView />}

        {phase.kind === 'error' && (
          <ErrorView
            message={phase.message}
            code={phase.code}
            onRetry={phase.code === 'rate_limit' || phase.code === 'network' || phase.code === 'server'
              ? () => runShorten(true)
              : undefined}
            onDismiss={() => setPhase({ kind: 'idle' })}
          />
        )}

        {phase.kind === 'ready' && (
          <ReadyView
            original={originalText}
            versions={versions}
            selected={selected}
            onSelect={setSelected}
            onApply={handleApply}
            onCancel={handleCancel}
            timePerReader={timePerReader}
            previewText={previewText}
            previewChars={previewChars}
            warnings={phase.result.warnings}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IdleView({
  original,
  creditsNeeded,
  tooShort,
  tooLong,
  needsConfirm,
  onRun,
}: {
  original: string;
  creditsNeeded: number;
  tooShort: boolean;
  tooLong: boolean;
  needsConfirm: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PreviewPanel
        title="Original"
        text={original}
        charCount={original.length}
        accent="muted"
        className="h-[42vh] min-h-[240px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <CreditEstimateBadge post={original} className="text-[12px] px-3 py-1" />
        {needsConfirm && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11.5px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Long post — will confirm before sending
          </span>
        )}
      </div>
      <DialogFooter className="flex-row justify-end">
        <Button
          disabled={tooShort || tooLong}
          onClick={onRun}
          size="lg"
          className="animate-saber-glow px-6 text-[13px] font-semibold"
        >
          Shorten (~{creditsNeeded} credit{creditsNeeded === 1 ? '' : 's'})
        </Button>
      </DialogFooter>
    </div>
  );
}

function ConfirmLongView({
  chars,
  credits,
  onCancel,
  onConfirm,
}: {
  chars: number;
  credits: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
        <p className="mb-1 flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Heavy post
        </p>
        <p>
          This is <strong>{chars.toLocaleString()} chars</strong> — roughly{' '}
          <strong>{credits} credits</strong>. Continue?
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Use ~{credits} credits
        </Button>
      </DialogFooter>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-8">
      <div className="saber-line w-48 animate-saber-ignite" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Sharpening the scalpel…
      </div>
    </div>
  );
}

function ErrorView({
  message,
  code,
  onRetry,
  onDismiss,
}: {
  message: string;
  code?: string;
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Something broke
        </p>
        <p className="text-foreground/90">{message}</p>
        {code && (
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            code: {code}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDismiss}>
          Dismiss
        </Button>
        {onRetry && (
          <Button onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

function ReadyView({
  original,
  versions,
  selected,
  onSelect,
  onApply,
  onCancel,
  timePerReader,
  previewText,
  previewChars,
  warnings,
}: {
  original: string;
  versions: Versions;
  selected: VersionKey;
  onSelect: (k: VersionKey) => void;
  onApply: () => void;
  onCancel: () => void;
  timePerReader: number;
  previewText: string;
  previewChars: number;
  warnings: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <PreviewPanel
          title="Original"
          text={original}
          charCount={original.length}
          accent="muted"
          className="h-[30vh] min-h-[180px] md:h-[46vh] md:min-h-[260px]"
        />
        <PreviewPanel
          title={`Shortened · ${selected}`}
          text={previewText}
          charCount={previewChars}
          accent="primary"
          className="h-[30vh] min-h-[180px] md:h-[46vh] md:min-h-[260px]"
        />
      </div>

      <VersionSlider value={selected} onChange={onSelect} />

      {warnings.length > 0 && (
        <ul className="space-y-1 text-[12.5px] text-amber-200/85">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <TimeSavedToastBody
          secondsPerReader={timePerReader}
          impactSeconds={impactSeconds(timePerReader)}
        />
        <DialogFooter className="flex-row gap-2 ml-auto">
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="px-5 text-[13px] font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={onApply}
            size="lg"
            disabled={!versions[selected]}
            className="animate-saber-glow px-6 text-[13px] font-semibold"
          >
            Apply
          </Button>
        </DialogFooter>
      </div>
    </div>
  );
}
