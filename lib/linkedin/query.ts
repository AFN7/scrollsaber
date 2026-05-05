/**
 * Recursive querySelector that walks through open shadow roots and same-origin
 * iframes. LinkedIn moved its share-modal editor into open shadow DOM, so a
 * plain `document.querySelectorAll` no longer finds the contenteditable.
 *
 * Cross-origin iframes are skipped (no access). Closed shadow roots are
 * invisible to JS — nothing we can do.
 */
export function queryAllDeep(selector: string, root: ParentNode = document): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new Set<Element>();

  const visit = (r: ParentNode) => {
    r.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      if (!seen.has(el)) {
        seen.add(el);
        out.push(el);
      }
    });
    // Descend into any element with an open shadowRoot.
    const elements = r.querySelectorAll<HTMLElement>('*');
    elements.forEach((el) => {
      const sr = el.shadowRoot;
      if (sr) visit(sr);
    });
    // Descend into same-origin iframes.
    r.querySelectorAll('iframe').forEach((frame) => {
      try {
        const doc = (frame as HTMLIFrameElement).contentDocument;
        if (doc && doc.body) visit(doc);
      } catch {
        /* cross-origin, skip */
      }
    });
  };

  visit(root);
  return out;
}

export function queryOneDeep(selector: string, root: ParentNode = document): HTMLElement | null {
  return queryAllDeep(selector, root)[0] ?? null;
}

/**
 * Walk upward from an element, traversing shadow-root and iframe boundaries,
 * looking for the first ancestor that matches `selector`.
 */
export function closestDeep(el: Element, selector: string): HTMLElement | null {
  let cur: Element | null = el;
  while (cur) {
    if (cur.matches?.(selector)) return cur as HTMLElement;
    // Use composed path: parentNode, then shadow host if we hit a shadow root.
    let parent: Node | null = cur.parentNode;
    if (!parent) {
      const rootNode = cur.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        parent = rootNode.host;
      }
    }
    cur = parent instanceof Element ? parent : null;
  }
  return null;
}
