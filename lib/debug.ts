/**
 * Prefixed logger. Verbose output is on under `wxt` dev and off in production;
 * set window.__SCROLLSABER_DEBUG__ = true in the console to turn it on there.
 * Errors always log.
 *
 * Never pass post content or API keys through these helpers. Only sizes,
 * counts, state names, selector matches, durations.
 */
const PREFIX = '[Scrollsaber]';

const win = globalThis as unknown as { __SCROLLSABER_DEBUG__?: boolean };

function enabled(): boolean {
  return win.__SCROLLSABER_DEBUG__ ?? import.meta.env.COMMAND === 'serve';
}

export function log(...args: unknown[]): void {
  if (enabled()) console.log(PREFIX, ...args);
}

export function warn(...args: unknown[]): void {
  if (enabled()) console.warn(PREFIX, ...args);
}

export function err(...args: unknown[]): void {
  // Errors always log.
  console.error(PREFIX, ...args);
}

export function group(label: string, fn: () => void): void {
  if (!enabled()) return fn();
  console.groupCollapsed(`${PREFIX} ${label}`);
  try {
    fn();
  } finally {
    console.groupEnd();
  }
}
