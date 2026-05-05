import * as React from 'react';
import { Swords, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
} from '@/lib/storage/settings';
import { resetStats } from '@/lib/storage/stats';
import { clearCache } from '@/lib/storage/cache';
import { testProvider } from '@/lib/llm/client';
import { OPENAI_PRESETS, findPreset } from '@/lib/llm/presets';
import type { Settings } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

type TestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; detail?: string }
  | { kind: 'err'; message: string };

export function Options() {
  const [settings, setSettingsLocal] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [testState, setTestState] = React.useState<TestState>({ kind: 'idle' });
  const saveTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    getSettings().then((s) => {
      setSettingsLocal(s);
      setLoaded(true);
    });
  }, []);

  function commit(next: Partial<Settings>) {
    const merged = { ...settings, ...next };
    setSettingsLocal(merged);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSettings(next).then(() => setSavedAt(Date.now()));
    }, 250);
  }

  async function onTest() {
    setTestState({ kind: 'loading' });
    const result = await testProvider(settings.provider, settings);
    if (result.ok) setTestState({ kind: 'ok' });
    else setTestState({ kind: 'err', message: result.error ?? 'Unknown error' });
  }

  function applyPreset(presetId: string) {
    const preset = findPreset(presetId);
    if (!preset) return;
    if (preset.id === 'custom') {
      commit({ openaiPreset: 'custom' });
      return;
    }
    commit({
      openaiPreset: preset.id,
      openaiBaseUrl: preset.baseUrl,
      openaiModel: preset.defaultModel,
    });
  }

  if (!loaded) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const hasKey =
    settings.provider === 'gemini'
      ? settings.geminiApiKey.trim().length > 0
      : settings.openaiBaseUrl.trim().length > 0 && settings.openaiModel.trim().length > 0;
  const activePreset = findPreset(settings.openaiPreset) ?? OPENAI_PRESETS[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Swords className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Scrollsaber Settings</h1>
          <p className="text-sm text-muted-foreground">Bring your own key. Stored locally.</p>
        </div>
        {savedAt && (
          <span className="ml-auto text-xs text-emerald-300">
            Saved
          </span>
        )}
      </header>

      <Section title="Provider" description="Which API handles the shortening.">
        <div className="flex gap-2">
          <ProviderPill
            active={settings.provider === 'gemini'}
            onClick={() => commit({ provider: 'gemini' })}
            label="Google Gemini"
            hint="Native API · free tier"
          />
          <ProviderPill
            active={settings.provider === 'openai'}
            onClick={() => commit({ provider: 'openai' })}
            label="OpenAI-compatible"
            hint="Groq, OpenRouter, DeepSeek, Cerebras…"
          />
        </div>
      </Section>

      {settings.provider === 'gemini' && (
        <Section
          title="Gemini API key"
          description={
            <>
              Stored in <code>chrome.storage.local</code> and sent only to Google.{' '}
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer noopener"
              >
                Get a free Gemini key
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <KeyInput
              placeholder="AIza…"
              value={settings.geminiApiKey}
              onChange={(v) => commit({ geminiApiKey: v })}
            />
            <TestRow hasKey={hasKey} testState={testState} onTest={onTest} />
          </div>
        </Section>
      )}

      {settings.provider === 'openai' && (
        <Section
          title="OpenAI-compatible endpoint"
          description={
            <>
              Pick a preset or enter any OpenAI-compatible URL. Stored in{' '}
              <code>chrome.storage.local</code> and sent only to that provider.
              {activePreset.keyUrl && (
                <>
                  {' '}
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={activePreset.keyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Get a {activePreset.label} key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Preset" hint={activePreset.notes}>
              <select
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                value={settings.openaiPreset}
                onChange={(e) => applyPreset(e.target.value)}
              >
                {OPENAI_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Base URL">
              <input
                type="text"
                spellCheck={false}
                placeholder="https://api.example.com/v1"
                value={settings.openaiBaseUrl}
                onChange={(e) =>
                  commit({ openaiBaseUrl: e.target.value, openaiPreset: 'custom' })
                }
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm"
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                spellCheck={false}
                placeholder="model-id"
                value={settings.openaiModel}
                onChange={(e) =>
                  commit({ openaiModel: e.target.value, openaiPreset: settings.openaiPreset })
                }
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm"
              />
            </Field>
            <Field label="API key" hint={`Format hint: ${activePreset.keyHint}`}>
              <KeyInput
                placeholder={activePreset.keyHint}
                value={settings.openaiApiKey}
                onChange={(v) => commit({ openaiApiKey: v })}
              />
            </Field>
            <TestRow hasKey={hasKey} testState={testState} onTest={onTest} />
          </div>
        </Section>
      )}

      <Section title="Defaults" description="Applied to every compose box on LinkedIn.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Output language">
            <select
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
              value={settings.language}
              onChange={(e) => commit({ language: e.target.value as Settings['language'] })}
            >
              <option value="auto">Auto-detect</option>
              <option value="tr">Turkish</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Accent color">
            <div className="flex gap-2">
              <ColorChip
                color="red"
                active={settings.accentColor === 'red'}
                onClick={() => commit({ accentColor: 'red' })}
              />
              <ColorChip
                color="blue"
                active={settings.accentColor === 'blue'}
                onClick={() => commit({ accentColor: 'blue' })}
              />
            </div>
          </Field>
          <Field
            label={`Daily credit cap (${settings.dailyCreditCap})`}
            hint="Soft-stops at this budget per day. Protects free-tier quotas."
          >
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={settings.dailyCreditCap}
              onChange={(e) => commit({ dailyCreditCap: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Reader mode"
        description="Auto-TL;DR above every long feed post. Skim before committing to read."
      >
        <div className="flex flex-col gap-3">
          <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.readerMode}
              onChange={(e) => commit({ readerMode: e.target.checked })}
              className="h-4 w-4 accent-[#FF3B3B]"
            />
            <span>Enable reader mode</span>
          </label>
          <Field
            label={`Minimum post length (${settings.readerMinChars} chars)`}
            hint="Posts below this are already concise and get no summary."
          >
            <input
              type="range"
              min={50}
              max={3000}
              step={25}
              value={settings.readerMinChars}
              onChange={(e) => commit({ readerMinChars: Number(e.target.value) })}
              disabled={!settings.readerMode}
              className="w-full"
            />
          </Field>
        </div>
      </Section>

      <Section title="Danger zone" description="Local data only — nothing is synced.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCache().then((n) => alert(`Cleared ${n} cached posts.`))}
          >
            Clear cache
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              confirm('Reset all stats? Cannot be undone.').valueOf() &&
              resetStats().then(() => alert('Stats reset.'))
            }
          >
            Reset stats
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ProviderPill(props: PillProps) {
  return <Pill {...props} />;
}

interface PillProps {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}

function Pill({ active, label, hint, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        active
          ? 'border-primary/60 bg-primary/15 text-primary shadow-[0_0_14px_rgba(255,59,59,0.25)]'
          : 'border-border bg-secondary/40 hover:bg-accent',
      )}
    >
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}

function KeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-sm"
      />
      <Button variant="outline" size="sm" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Hide' : 'Show'}
      </Button>
    </div>
  );
}

function TestRow({
  hasKey,
  testState,
  onTest,
}: {
  hasKey: boolean;
  testState: TestState;
  onTest: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasKey || testState.kind === 'loading'}
        onClick={onTest}
      >
        {testState.kind === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Test connection
      </Button>
      {testState.kind === 'ok' && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Works
        </span>
      )}
      {testState.kind === 'err' && (
        <span className="inline-flex items-center gap-1 text-xs text-red-300">
          <XCircle className="h-4 w-4" /> {testState.message}
        </span>
      )}
    </div>
  );
}

function ColorChip({
  color,
  active,
  onClick,
}: {
  color: 'red' | 'blue';
  active: boolean;
  onClick: () => void;
}) {
  const hex = color === 'red' ? '#FF3B3B' : '#3B82F6';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 w-14 rounded-md border transition-all',
        active ? 'border-white shadow-[0_0_12px_var(--chip)]' : 'border-border opacity-80',
      )}
      style={
        {
          backgroundColor: hex,
          ['--chip' as string]: hex,
        } as React.CSSProperties
      }
      aria-label={color}
    />
  );
}
