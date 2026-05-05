import { findComposeBoxes } from './dom';
import { findFeedPosts } from './feed';
import { log } from '@/lib/debug';

const MARKER_ATTR = 'data-scrollsaber-ready';
const MIN_SCAN_INTERVAL_MS = 250;
const SELF_TAG_PREFIX = 'scrollsaber-';

/** Returns true if the mutation batch contains meaningful additions from
 *  LinkedIn — not our own injected shadow roots, not pure attribute flips. */
function hasRealAdditions(mutations: MutationRecord[]): boolean {
  for (const m of mutations) {
    if (m.addedNodes.length === 0) continue;
    const target = m.target as HTMLElement;
    const tag = target.tagName?.toLowerCase();
    if (tag?.startsWith(SELF_TAG_PREFIX)) continue;
    // Added nodes from our own hosts shouldn't re-trigger scan either.
    let selfOnly = true;
    for (const node of Array.from(m.addedNodes)) {
      const el = node as HTMLElement;
      const nodeTag = el.tagName?.toLowerCase();
      if (!nodeTag || !nodeTag.startsWith(SELF_TAG_PREFIX)) {
        selfOnly = false;
        break;
      }
    }
    if (!selfOnly) return true;
  }
  return false;
}

/** RAF-debounced + min-interval-throttled runner. */
function makeThrottledRunner(fn: () => void): () => void {
  let scheduled = false;
  let lastRun = 0;
  return () => {
    if (scheduled) return;
    scheduled = true;
    const gap = Date.now() - lastRun;
    const delay = gap < MIN_SCAN_INTERVAL_MS ? MIN_SCAN_INTERVAL_MS - gap : 0;
    const fire = () => {
      scheduled = false;
      lastRun = Date.now();
      fn();
    };
    if (delay > 0) setTimeout(fire, delay);
    else requestAnimationFrame(fire);
  };
}

export interface ComposeWatcher {
  stop(): void;
}

export function watchForComposeBoxes(
  onAppear: (box: HTMLElement) => void,
): ComposeWatcher {
  const seen = new WeakSet<HTMLElement>();

  let lastCount = -1;
  let tickId = 0;
  const scan = () => {
    tickId += 1;
    const boxes = findComposeBoxes(document);
    if (boxes.length !== lastCount || tickId % 40 === 0) {
      log('compose tick', { tick: tickId, count: boxes.length });
      lastCount = boxes.length;
    }
    for (const box of boxes) {
      const hasMarker = box.getAttribute(MARKER_ATTR) === '1';
      if (seen.has(box) && hasMarker) continue;
      seen.add(box);
      box.setAttribute(MARKER_ATTR, '1');
      log('compose box new → onAppear', {
        cls: box.className?.toString().slice(0, 60),
        ariaLabel: box.getAttribute('aria-label')?.slice(0, 60),
      });
      onAppear(box);
    }
  };

  // DOM-event hooks (work across page / isolated-world boundary).
  window.addEventListener('scrollsaber:rescan', () => {
    log('manual rescan via event');
    scan();
  });

  window.addEventListener('scrollsaber:debug', () => {
    import('./dom').then(({ COMPOSE_SELECTORS }) => {
      const hits = COMPOSE_SELECTORS.map((sel) => ({
        sel: sel.slice(0, 70),
        count: document.querySelectorAll(sel).length,
      }));
      log('compose selector hits', hits);

      const iframes = Array.from(document.querySelectorAll('iframe'));
      log('iframes in page', iframes.length);
      iframes.forEach((frame, i) => {
        let accessible = false;
        let innerHits = 0;
        let innerContentEditable = 0;
        try {
          const doc = frame.contentDocument;
          if (doc) {
            accessible = true;
            innerContentEditable = doc.querySelectorAll('[contenteditable="true"]').length;
            innerHits = doc.querySelectorAll(
              '[data-test-ql-editor-contenteditable="true"], div.ql-editor[contenteditable="true"][role="textbox"]',
            ).length;
          }
        } catch {
          /* cross-origin */
        }
        log(`iframe[${i}]`, {
          src: frame.src?.slice(0, 80),
          name: frame.name?.slice(0, 40),
          title: frame.title?.slice(0, 40),
          accessible,
          innerContentEditable,
          innerComposeHits: innerHits,
        });
      });

      log('raw counts', {
        contenteditable: document.querySelectorAll('[contenteditable="true"]').length,
        textbox: document.querySelectorAll('[role="textbox"]').length,
        dialog: document.querySelectorAll('[role="dialog"]').length,
      });

      // Look for open shadow roots at top level.
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let shadowCount = 0;
      let shadowComposeHits = 0;
      let node: Node | null = walker.currentNode;
      while (node) {
        const el = node as HTMLElement;
        if (el.shadowRoot) {
          shadowCount += 1;
          shadowComposeHits += el.shadowRoot.querySelectorAll(
            '[contenteditable="true"]',
          ).length;
        }
        node = walker.nextNode();
      }
      log('shadow roots (open)', { count: shadowCount, composeHitsInside: shadowComposeHits });
    });
  });

  const runScan = makeThrottledRunner(scan);

  const observer = new MutationObserver((mutations) => {
    if (hasRealAdditions(mutations)) runScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Handle LinkedIn's pushState-based SPA navigation.
  const onHistoryEvent = () => runScan();
  window.addEventListener('popstate', onHistoryEvent);
  window.addEventListener('scrollsaber:nav', onHistoryEvent);

  // Monkey-patch history pushState once to emit a custom event.
  const anyWin = window as unknown as { __scrollsaberPatchedHistory?: boolean };
  if (!anyWin.__scrollsaberPatchedHistory) {
    anyWin.__scrollsaberPatchedHistory = true;
    const orig = history.pushState;
    history.pushState = function (this: History, ...args: Parameters<typeof history.pushState>) {
      const out = orig.apply(this, args);
      window.dispatchEvent(new Event('scrollsaber:nav'));
      return out;
    } as typeof history.pushState;
  }

  // Initial pass.
  scan();

  return {
    stop() {
      observer.disconnect();
      window.removeEventListener('popstate', onHistoryEvent);
      window.removeEventListener('scrollsaber:nav', onHistoryEvent);
    },
  };
}

export interface FeedWatcher {
  stop(): void;
}

export function watchForFeedPosts(
  onAppear: (post: HTMLElement) => void,
): FeedWatcher {
  const seen = new WeakSet<HTMLElement>();

  let lastLoggedCount = 0;
  const scan = () => {
    const posts = findFeedPosts(document);
    if (posts.length !== lastLoggedCount) {
      log('feed scan: found', posts.length, 'post(s)');
      lastLoggedCount = posts.length;
    }
    for (const post of posts) {
      if (seen.has(post)) continue;
      // No DOM-attribute marker — setting one triggers React reconciliation on
      // LinkedIn's side. WeakSet is enough: the element itself is the key, and
      // when React swaps the post the WeakSet loses reference and we re-scan.
      seen.add(post);
      log('feed post new → onAppear', { urn: post.getAttribute('data-urn') ?? post.getAttribute('componentkey')?.slice(0, 40) });
      onAppear(post);
    }
  };

  const runScan = makeThrottledRunner(scan);

  const observer = new MutationObserver((mutations) => {
    if (hasRealAdditions(mutations)) runScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  scan();

  return {
    stop() {
      observer.disconnect();
    },
  };
}
