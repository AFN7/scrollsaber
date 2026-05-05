import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { estimateCredits, detectLanguageHint } from '@/lib/credits/estimator';
import type { DetectedLanguage } from '@/lib/types';

interface Props {
  post: string;
  language?: DetectedLanguage;
  className?: string;
}

const tierClass = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
} as const;

export function CreditEstimateBadge({ post, language, className }: Props) {
  const estimate = useMemo(() => {
    const lang = language ?? detectLanguageHint(post);
    return estimateCredits(post, lang);
  }, [post, language]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tierClass[estimate.tier],
        className,
      )}
      title={`~${estimate.inputTokens} in + ~${estimate.outputTokens} out tokens`}
    >
      <Sparkles className="h-3 w-3" />
      ~{estimate.credits} credit{estimate.credits === 1 ? '' : 's'}
    </span>
  );
}
