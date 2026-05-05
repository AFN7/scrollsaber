import { cn } from '@/lib/utils/cn';

interface Props {
  title: string;
  text: string;
  charCount: number;
  accent?: 'muted' | 'primary';
  readOnly?: boolean;
  className?: string;
}

export function PreviewPanel({ title, text, charCount, accent = 'muted', className }: Props) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-black/30',
        accent === 'primary'
          ? 'border-[#FF3B3B]/35 shadow-[0_0_22px_-10px_rgba(255,59,59,0.45)]'
          : 'border-white/[0.07]',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
        <span
          className={cn(
            'text-[11.5px] font-semibold uppercase tracking-[0.12em]',
            accent === 'primary' ? 'text-[#FF6A6A]' : 'text-neutral-300',
          )}
        >
          {title}
        </span>
        <span className="tabular-nums text-[11.5px] font-medium text-neutral-300">
          {charCount.toLocaleString()} chars
        </span>
      </div>
      <div
        className="flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 py-4 text-[15px] leading-[1.6] text-neutral-50"
        style={{ overscrollBehavior: 'contain' }}
      >
        {text || <span className="italic text-neutral-500">—</span>}
      </div>
    </div>
  );
}
