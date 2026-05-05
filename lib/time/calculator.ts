const WPM = 200;
const SECONDS_PER_MINUTE = 60;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function readingSeconds(text: string): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.round((words / WPM) * SECONDS_PER_MINUTE);
}

export function timeSavedSeconds(original: string, shortened: string): number {
  return Math.max(0, readingSeconds(original) - readingSeconds(shortened));
}

export function impactSeconds(secondsPerViewer: number, estimatedViewers = 300): number {
  return Math.max(0, secondsPerViewer * estimatedViewers);
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return 'a moment';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) {
    return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return mm ? `${hours}h ${mm}m` : `${hours}h`;
}

export function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '<1';
  return minutes.toString();
}
