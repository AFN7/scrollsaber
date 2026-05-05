/**
 * Tiny, prefixed logger. On by default during iteration — flip the global
 * flag below to false before shipping a production build.
 *
 * Never pass post content or API keys through these helpers. Only sizes,
 * counts, state names, selector matches, durations.
 */
const PREFIX = '[Scrollsaber]';

// Toggle-friendly: set window.__SCROLLSABER_DEBUG__ = false in the console to
// silence at runtime without rebuild.
const win = globalThis as unknown as { __SCROLLSABER_DEBUG__?: boolean };
if (win.__SCROLLSABER_DEBUG__ === undefined) {
  win.__SCROLLSABER_DEBUG__ = true;
}

function enabled(): boolean {
  return win.__SCROLLSABER_DEBUG__ !== false;
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
