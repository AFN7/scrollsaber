import * as React from 'react';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import {
  TIER_LABELS,
  TIER_ORDER,
  recommendedOption,
  formatCostPerPost,
  type ModelOption,
} from '@/lib/llm/models';

type ListState =
  | { kind: 'idle' }
  | { kind: 'stale' }
  | { kind: 'loading' }
  | { kind: 'ok'; models: ModelOption[] }
  | { kind: 'err'; message: string };

const OTHER = '__other__';

/** Wait this long after the last keystroke in the key or URL field before listing. */
const RELOAD_DEBOUNCE_MS = 600;

export interface ModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  /** Fetches the catalog with the current URL and key. Null while either is missing. */
  load: ((signal: AbortSignal) => Promise<ModelOption[]>) | null;
  /**
   * The key. Editing it lists models on its own (after typing stops).
   * Editing the target does not: a key pasted for one provider must not be
   * sent to another host the moment the preset or URL changes, so a target
   * change waits for Refresh.
   */
  autoKey: string;
  /** Where the list comes from (base URL). */
  targetKey: string;
  /** Shown instead of the list while `load` is null. */
  missingHint: string;
  /** Model the "use recommended" shortcut prefers when the catalog has it. */
  preferredId?: string;
}

export function ModelPicker({
  value,
  onChange,
  load,
  autoKey,
  targetKey,
  missingHint,
  preferredId,
}: ModelPickerProps) {
  const [state, setState] = React.useState<ListState>({ kind: 'idle' });
  const [reloadTick, setReloadTick] = React.useState(0);
  const [typing, setTyping] = React.useState(false);
  const seen = React.useRef<{ auto: string; target: string; tick: number } | null>(null);

  React.useEffect(() => {
    const prev = seen.current;
    seen.current = { auto: autoKey, target: targetKey, tick: reloadTick };
    if (!load) {
      setState({ kind: 'idle' });
      return;
    }
    const refreshed = prev !== null && reloadTick !== prev.tick;
    const keyEdited = prev !== null && autoKey !== prev.auto;
    const targetOnly = prev !== null && !refreshed && !keyEdited && targetKey !== prev.target;
    if (targetOnly) {
      setState({ kind: 'stale' });
      return;
    }
    const ctrl = new AbortController();
    // First mount and Refresh list right away; key edits wait for typing to stop.
    const immediate = !keyEdited;
    const timer = window.setTimeout(
      () => {
        setState({ kind: 'loading' });
        load(ctrl.signal)
          .then((models) => {
            if (!ctrl.signal.aborted) setState({ kind: 'ok', models });
          })
          .catch((e: unknown) => {
            if (ctrl.signal.aborted) return;
            setState({ kind: 'err', message: e instanceof Error ? e.message : 'Could not list models' });
          });
      },
      immediate ? 0 : RELOAD_DEBOUNCE_MS,
    );
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [load, autoKey, targetKey, reloadTick]);

  const models = state.kind === 'ok' ? state.models : [];
  const listed = models.some((m) => m.id === value);
  const recommended = recommendedOption(models, preferredId);
  const onlyUnpriced = models.every((m) => m.tier === 'unknown');
  const showSelect = state.kind === 'ok' && models.length > 0 && !typing;

  const status = (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      {state.kind === 'loading' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Listing models
        </>
      )}
      {state.kind === 'ok' && <span>{models.length} models listed</span>}
      {load && state.kind !== 'loading' && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={() => setReloadTick((n) => n + 1)}
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">Model</span>
        {status}
      </div>

      {showSelect ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm"
            value={listed ? value : OTHER}
            onChange={(e) => {
              if (e.target.value === OTHER) setTyping(true);
              else onChange(e.target.value);
            }}
          >
            {!listed && <option value={OTHER}>{value || 'Pick a model'}</option>}
            {TIER_ORDER.map((tier) => {
              const group = models.filter((m) => m.tier === tier);
              if (group.length === 0) return null;
              return (
                <optgroup
                  key={tier}
                  label={tier === 'unknown' && onlyUnpriced ? 'Models' : TIER_LABELS[tier]}
                >
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {optionText(m, recommended?.id)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {listed && <option value={OTHER}>Other model id…</option>}
          </select>
          {recommended && recommended.id !== value && (
            <button
              type="button"
              onClick={() => onChange(recommended.id)}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-accent"
              title={recommended.id}
            >
              Use recommended
              <span className="block font-mono text-[11px] text-muted-foreground">
                {recommended.costPerPost !== undefined
                  ? `${shortId(recommended.id)} · ${formatCostPerPost(recommended.costPerPost)}`
                  : shortId(recommended.id)}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            spellCheck={false}
            placeholder="model-id"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            className="min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm"
          />
          {typing && (
            <button
              type="button"
              className="shrink-0 text-xs text-primary hover:underline"
              onClick={() => setTyping(false)}
            >
              Back to list
            </button>
          )}
        </div>
      )}

      {!load && <span className="text-xs text-muted-foreground">{missingHint}</span>}
      {state.kind === 'stale' && (
        <span className="text-xs text-muted-foreground">
          Address changed. Press Refresh to list the models there.
        </span>
      )}
      {showSelect && models.some((m) => m.costPerPost !== undefined) && (
        <span className="text-xs text-muted-foreground">
          Prices are the provider's, for one post of about 1,500 characters.
        </span>
      )}
      {state.kind === 'err' && (
        <span className="text-xs text-muted-foreground">
          {state.message}. Type the model id by hand.
        </span>
      )}
      {state.kind === 'ok' && value && !listed && (
        <span className="inline-flex items-start gap-1 text-xs text-amber-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            <code>{value}</code> is not in this key's model list. Requests will fail unless the
            provider still serves it; pick one from the list.
          </span>
        </span>
      )}
    </div>
  );
}

function optionText(m: ModelOption, recommendedId?: string): string {
  const parts = [m.id];
  if (m.costPerPost !== undefined) parts.push(`· ${formatCostPerPost(m.costPerPost)}`);
  if (m.id === recommendedId) parts.push('· recommended');
  return parts.join(' ');
}

function shortId(id: string): string {
  return id.length > 34 ? `${id.slice(0, 33)}…` : id;
}
