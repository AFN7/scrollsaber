// LinkedIn ships hashed CSS class names (e.g. `_88a4b558`) that rotate with
// every build, precisely to defeat class-selector-based extensions. Instead
// we anchor onto semantic attributes they have to keep stable for their own
// test framework and assistive tech: `componentkey`, `data-testid`,
// `data-urn`, `role`, and aria-*.
// Only match the outer post wrapper, not the dozen helper components
// (comment tools, "load more", skeleton placeholders, etc.) LinkedIn also
// renders under role="listitem". The real wrapper's componentkey starts with
// "expanded" and contains a FeedType marker. data-urn fallback covers older
// markup where componentkey isn't wired.
const POST_SELECTORS = [
  '[componentkey^="expanded"][componentkey*="FeedType_MAIN_FEED"]',
  '[componentkey^="expanded"][componentkey*="FeedType_"]',
  '[data-urn^="urn:li:activity:"]',
  '[data-urn^="urn:li:aggregate:"]',
];

const TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '[data-testid*="expandable-text"]',
  '[data-testid*="post-text"]',
  '[data-testid*="text-box"]',
];

export function findFeedPosts(root: ParentNode = document): HTMLElement[] {
  const all: HTMLElement[] = [];
  const seen = new Set<Element>();
  for (const sel of POST_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => {
      if (!seen.has(el)) {
        seen.add(el);
        all.push(el as HTMLElement);
      }
    });
  }
  // Keep only OUTERMOST matches (LinkedIn nests several marker elements).
  const outer = all.filter((m) => !all.some((other) => other !== m && other.contains(m)));
  // Only real text posts — those containing a recognized text container.
  // Excludes "people you may know" carousels, job cards, follow suggestions,
  // sponsored "View profile" cards, and similar non-post feed items.
  return outer.filter((post) => TEXT_SELECTORS.some((sel) => post.querySelector(sel)));
}

export function findTextContainer(post: HTMLElement): HTMLElement | null {
  for (const sel of TEXT_SELECTORS) {
    const el = post.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

export function extractPostText(post: HTMLElement): string {
  const el = findTextContainer(post);
  if (!el) return '';
  return (el.innerText ?? '').trim();
}

export function isOwnPost(_post: HTMLElement): boolean {
  // Placeholder — could check for "You" or the author link against the user's
  // own profile URN. For now we summarize everyone's posts; compose mode handles
  // the "writing my own" case.
  return false;
}

export function findTldrMountPoint(post: HTMLElement): HTMLElement | null {
  // Returning the post itself (not its text container) so the injector can
  // mount our custom element as a *sibling* of the post card instead of
  // inside LinkedIn's React-managed subtree. Keeps their reconciler happy.
  return post;
}
