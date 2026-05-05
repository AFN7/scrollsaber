import * as React from 'react';
import { Swords, Settings as SettingsIcon, Timer, Coins, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStats, rolloverWindows, remainingDailyCredits } from '@/lib/storage/stats';
import { getSettings, hasApiKey } from '@/lib/storage/settings';
import { formatDuration } from '@/lib/time/calculator';
import type { Settings, Stats } from '@/lib/types';

const FUN_FACTS: Array<(minutes: number) => string> = [
  (m) => `≈ ${Math.round(m / 30)} standup${Math.round(m / 30) === 1 ? '' : 's'} of focus time`,
  (m) => `≈ ${Math.round(m / 15)} coffee-break${Math.round(m / 15) === 1 ? '' : 's'} returned`,
  (m) => `≈ ${Math.round(m / 45)} deep-work session${Math.round(m / 45) === 1 ? '' : 's'} reclaimed`,
];

export function Popup() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    Promise.all([getStats(), getSettings()]).then(([s, cfg]) => {
      if (!mounted) return;
      setStats(rolloverWindows(s));
      setSettings(cfg);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !stats || !settings) {
    return (
      <div className="flex min-h-[260px] w-[340px] items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const posts = stats.postsShortened;
  const minutes = Math.round(stats.readingSecondsSaved / 60);
  const credits = stats.rollingWindow.creditsConsumed;
  // Only surface the fun comparison once there's meaningful time to compare to.
  const fact = minutes >= 15
    ? (FUN_FACTS[posts % FUN_FACTS.length]?.(minutes) ?? undefined)
    : undefined;

  const dailyRemaining = remainingDailyCredits(stats, settings.dailyCreditCap);
  const usedToday = Math.max(0, settings.dailyCreditCap - dailyRemaining);

  return (
    <div className="flex w-[340px] flex-col gap-4 p-4 text-foreground">
      <header className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-primary" />
        <h1 className="text-base font-semibold">Scrollsaber</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          {settings.provider === 'gemini' ? 'Gemini' : 'OpenAI-compat'}
        </span>
      </header>

      {posts === 0 ? (
        <EmptyState onOpenOptions={openOptions} hasKey={hasApiKey(settings)} />
      ) : (
        <>
          <StatCard icon={<Swords className="h-4 w-4" />} label="Posts shortened" value={posts.toString()} />
          <StatCard
            icon={<Timer className="h-4 w-4" />}
            label="Reader minutes saved"
            value={minutes.toString()}
            hint={fact}
          />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            label="Credits this 30d"
            value={credits.toString()}
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            label="Today"
            value={`${usedToday} / ${settings.dailyCreditCap} credits`}
            hint={`${dailyRemaining} left, resets at midnight UTC`}
          />
          <div className="text-[11px] text-muted-foreground">
            Total readers helped: ~{Math.round((stats.readingSecondsSaved * 300) / 3600)} reader-hours
            · Last use: {stats.lastUseAt ? formatDuration(Math.floor((Date.now() - stats.lastUseAt) / 1000)) + ' ago' : 'never'}
          </div>
        </>
      )}

      <Button variant="outline" size="sm" onClick={openOptions} className="mt-auto">
        <SettingsIcon className="mr-2 h-4 w-4" />
        Settings
      </Button>
    </div>
  );
}

function EmptyState({ onOpenOptions, hasKey }: { onOpenOptions: () => void; hasKey: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      {hasKey ? (
        <>
          <p className="font-medium">Ready to cut.</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Open a LinkedIn compose box, type a post, then click the Scrollsaber button.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">Add your API key to start.</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Scrollsaber uses your own key — stored locally, never sent anywhere but the model.
          </p>
          <Button size="sm" className="mt-3 w-full" onClick={onOpenOptions}>
            Open settings
          </Button>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="text-primary">{icon}</div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-base font-semibold leading-tight tabular-nums">{value}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function openOptions() {
  browser.runtime.openOptionsPage();
}
