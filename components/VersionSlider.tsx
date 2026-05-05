import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/cn';
import type { VersionKey } from '@/lib/types';

export const VERSION_KEYS: VersionKey[] = ['v75', 'v50', 'v25', 'v_one'];

const LABELS: Record<VersionKey, { short: string; long: string }> = {
  v75: { short: '75%', long: 'Trim (75%)' },
  v50: { short: '50%', long: 'Tight (50%)' },
  v25: { short: '25%', long: 'Terse (25%)' },
  v_one: { short: '1 sentence', long: 'Single sentence' },
};

interface Props {
  value: VersionKey;
  onChange: (key: VersionKey) => void;
  disabled?: boolean;
}

export function VersionSlider({ value, onChange, disabled }: Props) {
  const idx = VERSION_KEYS.indexOf(value);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <Slider
          min={0}
          max={VERSION_KEYS.length - 1}
          step={1}
          value={[idx < 0 ? 0 : idx]}
          disabled={disabled}
          onValueChange={(next) => {
            const n = next[0] ?? 0;
            onChange(VERSION_KEYS[n] ?? 'v75');
          }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {VERSION_KEYS.map((k) => {
          const active = k === value;
          return (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChange(k)}
              className={cn(
                'rounded-md px-3 py-2 text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-[#FF3B3B]/[0.18] text-[#FF6A6A] shadow-[inset_0_0_0_1px_rgba(255,106,106,0.38)]'
                  : 'bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-neutral-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
                disabled && 'opacity-50',
              )}
              aria-pressed={active}
              title={LABELS[k].long}
            >
              {LABELS[k].short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function versionLabel(k: VersionKey): string {
  return LABELS[k].long;
}
