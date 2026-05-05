import { Timer } from 'lucide-react';
import { formatDuration } from '@/lib/time/calculator';

interface Props {
  secondsPerReader: number;
  impactSeconds: number;
  className?: string;
}

export function TimeSavedToastBody({ secondsPerReader, impactSeconds }: Props) {
  if (secondsPerReader <= 0) {
    return (
      <span className="flex items-center gap-2 text-[13px] text-neutral-300">
        <Timer className="h-4 w-4" /> Already tight — no reader time to reclaim.
      </span>
    );
  }
  return (
    <span
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-200"
      title="Per-reader time uses 200 WPM. The ‘total’ estimate assumes ≈300 viewers per post — adjust mentally for your actual reach."
    >
      <Timer className="h-4 w-4 shrink-0 text-[#FF6A6A]" />
      <span>
        Each reader saves{' '}
        <strong className="font-semibold text-neutral-50">
          ~{formatDuration(secondsPerReader)}
        </strong>
      </span>
      {impactSeconds > 0 && (
        <span className="text-neutral-400">
          · est.{' '}
          <strong className="font-semibold text-neutral-200">
            ~{formatDuration(impactSeconds)}
          </strong>{' '}
          across ≈300 viewers
        </span>
      )}
    </span>
  );
}
