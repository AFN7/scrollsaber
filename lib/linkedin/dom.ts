export const COMPOSE_SELECTORS = [
  // Most stable: LinkedIn's own test hook.
  '[data-test-ql-editor-contenteditable="true"]',
  // Quill editor shape — ql-editor class comes from Quill library, stable.
  'div.ql-editor[contenteditable="true"][role="textbox"]',
  // Generic multiline contenteditable inside a dialog.
  '[role="dialog"] [contenteditable="true"][role="textbox"][aria-multiline="true"]',
  // Language-aware placeholder fallbacks (tr + en).
  'div[contenteditable="true"][role="textbox"][aria-placeholder*="konuş" i]',
  'div[contenteditable="true"][role="textbox"][aria-placeholder*="talk" i]',
  'div[contenteditable="true"][role="textbox"][data-placeholder*="konuş" i]',
  'div[contenteditable="true"][role="textbox"][data-placeholder*="talk" i]',
  'div[contenteditable="true"][role="textbox"][aria-label*="post" i]',
  'div[contenteditable="true"][role="textbox"][aria-label*="paylaş" i]',
];

import { queryAllDeep } from './query';

export function findComposeBoxes(root: ParentNode = document): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const seen = new Set<Element>();
  for (const sel of COMPOSE_SELECTORS) {
    for (const el of queryAllDeep(sel, root)) {
      if (!seen.has(el)) {
        seen.add(el);
        matches.push(el);
      }
    }
  }
  return matches;
}

export function findComposeBox(root: ParentNode = document): HTMLElement | null {
  return findComposeBoxes(root)[0] ?? null;
}

/**
 * Find where to mount the Scrollsaber button relative to a compose editor.
 *
 * LinkedIn localises aria-labels and rotates CSS class names, so we try many
 * strategies. We degrade gracefully: toolbar → sibling action row →
 * floating overlay inside the dialog → floating overlay next to the editor.
 */
export interface InjectionAnchor {
  anchor: HTMLElement;
  append: 'first' | 'last';
  floating: boolean;
}

const TOOLBAR_SELECTORS = [
  '.share-creation-state__additional-toolbar',
  '.share-creation-state__footer',
  '[data-test-id*="footer" i]',
  '.share-box_footer',
  '.share-box-modal__footer',
  '.editor-toolbar',
  '[role="toolbar"]',
];

const ACTION_BUTTON_SELECTORS = [
  'button[aria-label*="emoji" i]',
  'button[aria-label*="ifade" i]', // Turkish: "İfade ekle"
  'button[aria-label*="image" i]',
  'button[aria-label*="görsel" i]',
  'button[aria-label*="foto" i]',
  'button[aria-label*="schedule" i]',
  'button[aria-label*="zamanla" i]',
  'button[aria-label*="media" i]',
];

export function findInjectionAnchor(compose: HTMLElement): InjectionAnchor {
  // Walk up through shadow roots to find the dialog wrapper. `closest()`
  // stops at the shadow boundary, so we use our composed-path helper.
  const rootNode = compose.getRootNode();
  const scopeRoot: ParentNode =
    rootNode instanceof ShadowRoot ? rootNode : rootNode instanceof Document ? rootNode : document;
  const dialog =
    compose.closest<HTMLElement>('[role="dialog"], .share-box-modal, .share-creation-state') ??
    scopeRoot.querySelector<HTMLElement>('.share-creation-state, .share-box-modal, [role="dialog"]');

  const scope: ParentNode = dialog ?? compose.parentElement ?? scopeRoot;

  // Strategy 1: known toolbar containers.
  for (const sel of TOOLBAR_SELECTORS) {
    const el = scope.querySelector<HTMLElement>(sel);
    if (el) return { anchor: el, append: 'first', floating: false };
  }

  // Strategy 2: find any locale-insensitive action button and use its row.
  for (const sel of ACTION_BUTTON_SELECTORS) {
    const btn = scope.querySelector<HTMLElement>(sel);
    if (btn?.parentElement) {
      return { anchor: btn.parentElement, append: 'first', floating: false };
    }
  }

  // Strategy 3: float inside the dialog.
  if (dialog) {
    return { anchor: dialog, append: 'last', floating: true };
  }

  // Strategy 4: last resort — float next to the editor.
  return {
    anchor: compose.parentElement ?? compose,
    append: 'last',
    floating: true,
  };
}

/** @deprecated Prefer findInjectionAnchor(); retained for call-sites that only need a toolbar. */
export function findToolbarForCompose(compose: HTMLElement): HTMLElement | null {
  const a = findInjectionAnchor(compose);
  return a.floating ? null : a.anchor;
}

export function getComposeText(compose: HTMLElement): string {
  // innerText preserves user-visible line breaks, unlike textContent.
  return compose.innerText ?? '';
}

export function focusCompose(compose: HTMLElement): void {
  try {
    compose.focus();
  } catch {
    /* ignore */
  }
}

/**
 * Replace the text content of a LinkedIn contenteditable.
 *
 * We clear via Selection+execCommand('insertText','') so React / Quill's own
 * observers see real input events, then insert the new text the same way.
 * This path is fragile but matches how LinkedIn's own emoji picker writes.
 */
export function replaceComposeText(compose: HTMLElement, nextText: string): boolean {
  focusCompose(compose);
  const doc = compose.ownerDocument;
  const win = doc.defaultView ?? window;
  const sel = win.getSelection();
  if (!sel) return false;

  const range = doc.createRange();
  range.selectNodeContents(compose);
  sel.removeAllRanges();
  sel.addRange(range);

  // Delete selection.
  try {
    doc.execCommand('delete');
  } catch {
    /* ignore */
  }

  // Insert new text, converting explicit newlines into line breaks.
  const lines = nextText.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const chunk = lines[i];
    if (chunk) {
      try {
        doc.execCommand('insertText', false, chunk);
      } catch {
        // Fallback: append text nodes directly.
        compose.appendChild(doc.createTextNode(chunk));
      }
    }
    if (i < lines.length - 1) {
      try {
        doc.execCommand('insertLineBreak');
      } catch {
        compose.appendChild(doc.createElement('br'));
      }
    }
  }

  // Fire input event so React/Quill picks it up.
  compose.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  return true;
}
