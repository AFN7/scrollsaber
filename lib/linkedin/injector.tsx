import * as React from 'react';
import ReactDOM from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/client';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/client';
import { ScrollsaberButton } from '@/components/ScrollsaberButton';
import { ShortenModal } from '@/components/ShortenModal';
import { ToasterProvider, useToaster } from '@/components/ui/toaster';
import {
  findInjectionAnchor,
  focusCompose,
  getComposeText,
  replaceComposeText,
  type InjectionAnchor,
} from './dom';
import { watchForComposeBoxes, watchForFeedPosts } from './observer';
import { extractPostText, findTldrMountPoint } from './feed';
import { ReaderTLDR } from '@/components/ReaderTLDR';
import { log, warn, err } from '@/lib/debug';
import {
  getSettings,
  hasApiKey,
  watchSettings,
} from '@/lib/storage/settings';
import { formatDuration } from '@/lib/time/calculator';
import { timeSavedSeconds, impactSeconds } from '@/lib/time/calculator';
import type { Settings, VersionKey, Versions } from '@/lib/types';

interface ComposeBinding {
  compose: HTMLElement;
  ui: ShadowRootContentScriptUi<ReactDOM.Root>;
}

interface UndoEntry {
  compose: HTMLElement;
  before: string;
}

const bindings = new WeakMap<HTMLElement, ComposeBinding>();
const attaching = new WeakSet<HTMLElement>();
const undoStacks = new WeakMap<HTMLElement, UndoEntry[]>();
const MAX_UNDO = 3;

let openModalFn: ((payload: OpenPayload) => void) | null = null;

interface OpenPayload {
  compose: HTMLElement;
  text: string;
}

export async function mountLinkedInInjector(ctx: ContentScriptContext): Promise<void> {
  await mountModal(ctx);

  const composeWatcher = watchForComposeBoxes(async (compose) => {
    await attachButtonToCompose(ctx, compose);
  });

  const settingsRef = { current: await getSettings() };
  const unwatchSettings = watchSettings((s) => {
    settingsRef.current = s;
  });

  const feedWatcher = watchForFeedPosts((post) => {
    attachTldrToFeedPost(ctx, post, settingsRef).catch(() => {});
  });

  ctx.onInvalidated(() => {
    composeWatcher.stop();
    feedWatcher.stop();
    unwatchSettings();
  });

  // Listen for background-script keyboard command.
  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = raw as { type?: string } | null | undefined;
    if (msg?.type !== 'scrollsaber:open') return;
    const active = document.activeElement as HTMLElement | null;
    const compose =
      active && (active.getAttribute('contenteditable') === 'true' ? active : null);
    if (!compose) return;
    const text = getComposeText(compose);
    openModalFn?.({ compose, text });
  });
}

async function waitForAnchor(
  compose: HTMLElement,
  attempts = 20,
  delayMs = 120,
): Promise<InjectionAnchor> {
  for (let i = 0; i < attempts; i += 1) {
    if (!compose.isConnected) throw new Error('compose detached');
    const a = findInjectionAnchor(compose);
    // Strategy 1 & 2 (non-floating) are preferred; accept floating only after
    // a few retries so LinkedIn has a chance to render the proper toolbar.
    if (!a.floating || i > 6) return a;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return findInjectionAnchor(compose);
}

async function attachButtonToCompose(ctx: ContentScriptContext, compose: HTMLElement) {
  // Guard against concurrent attach calls (observer scan racing with manual
  // re-attach, multiple observer batches, etc.). Without this the button can
  // render 2–3 times when LinkedIn re-parents the toolbar.
  if (attaching.has(compose) || bindings.has(compose)) {
    log('compose attach skipped: already in-flight or mounted');
    return;
  }
  attaching.add(compose);

  let anchorInfo: InjectionAnchor;
  try {
    anchorInfo = await waitForAnchor(compose);
  } catch (e) {
    warn('compose anchor lookup failed', e);
    attaching.delete(compose);
    return;
  }
  log('compose anchor resolved', {
    floating: anchorInfo.floating,
    append: anchorInfo.append,
    anchorTag: anchorInfo.anchor.tagName,
    anchorClass: anchorInfo.anchor.className?.toString().slice(0, 60),
  });

  const ui = await createShadowRootUi(ctx, {
    name: 'scrollsaber-button',
    position: 'inline',
    anchor: anchorInfo.anchor,
    append: anchorInfo.append,
    onMount(container) {
      // Strip all styling from the shadow HOST element (the custom element in
      // the light DOM) so the rounded pill is the only visible shape. Using
      // :host inside the shadow root's own stylesheet hits the host cleanly.
      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        const hostReset = document.createElement('style');
        hostReset.textContent = `:host {
          all: initial;
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
        }`;
        rootNode.appendChild(hostReset);
      }
      // Inner container — still give it inline-flex so the pill lays out.
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';
      container.style.verticalAlign = 'middle';
      container.style.background = 'transparent';
      container.style.border = 'none';
      container.style.boxShadow = 'none';
      container.style.padding = '0';
      container.style.margin = '0';
      // LinkedIn's focus-trap walks descendants and calls getComputedStyle on
      // them; it crashes on text nodes inside custom elements. Hiding the host
      // from its traversal (tabindex -1 + aria-hidden on the host only) lets
      // their trap skip us while the inner button stays usable.
      container.setAttribute('tabindex', '-1');
      container.setAttribute('data-scrollsaber-skip-focus-trap', '1');
      if (anchorInfo.floating) {
        container.style.position = 'absolute';
        container.style.top = '76px';
        container.style.right = '20px';
        container.style.zIndex = '10';
        container.style.pointerEvents = 'auto';
      }
      const root = ReactDOM.createRoot(container);
      root.render(
        <ScrollsaberButton
          onClick={() => {
            const text = getComposeText(compose);
            log('compose button clicked', {
              textLen: text.length,
              hasOpenModal: !!openModalFn,
            });
            if (!openModalFn) {
              warn('openModalFn is null — modal host not ready yet');
              return;
            }
            openModalFn({ compose, text });
          }}
        />,
      );
      return root;
    },
    onRemove(root) {
      root?.unmount();
    },
  });

  ui.mount();
  bindings.set(compose, { compose, ui });
  attaching.delete(compose);

  // Host lookup via document.querySelector would fail when LinkedIn's compose
  // lives inside a shadow root (it does, as of 2026). The successful mount +
  // onAppear log is sufficient evidence; skipping the rect diagnostic.

  // Track the anchor we injected next to. When LinkedIn opens a sub-dialog
  // (media picker, event, celebrate) the toolbar re-renders and our anchor
  // gets replaced, leaving our shadow host orphaned. Detect that and re-attach.
  const injectedAnchor = anchorInfo.anchor;

  const detachObserver = new MutationObserver(() => {
    if (!compose.isConnected) {
      ui.remove();
      bindings.delete(compose);
      compose.removeAttribute('data-scrollsaber-ready');
      detachObserver.disconnect();
      return;
    }
    if (!injectedAnchor.isConnected) {
      log('compose toolbar re-rendered; re-attaching');
      ui.remove();
      bindings.delete(compose);
      compose.removeAttribute('data-scrollsaber-ready');
      detachObserver.disconnect();
      requestAnimationFrame(() => {
        if (compose.isConnected) attachButtonToCompose(ctx, compose).catch(() => {});
      });
    }
  });
  detachObserver.observe(document.body, { childList: true, subtree: true });
}

// ---------- Reader mode (feed-post TL;DR) ----------

interface SettingsRef {
  current: Settings;
}

async function attachTldrToFeedPost(
  ctx: ContentScriptContext,
  post: HTMLElement,
  settingsRef: SettingsRef,
): Promise<void> {
  // Respect settings: reader mode opt-out + cap.
  const settings = settingsRef.current;
  if (!settings.readerMode) {
    log('tldr skipped: readerMode disabled');
    return;
  }

  // Wait briefly for the text container to render.
  let text = extractPostText(post);
  for (let i = 0; i < 10 && !text && post.isConnected; i += 1) {
    await new Promise((r) => setTimeout(r, 200));
    text = extractPostText(post);
  }
  if (!post.isConnected) {
    log('tldr skipped: post detached while waiting for text');
    return;
  }
  if (text.length < settings.readerMinChars) {
    log('tldr skipped: text too short', { len: text.length, min: settings.readerMinChars });
    return;
  }

  const mountPoint = findTldrMountPoint(post);
  if (!mountPoint) {
    warn('tldr mount point not found');
    return;
  }

  let ui;
  try {
    ui = await createShadowRootUi(ctx, {
      name: 'scrollsaber-tldr',
      position: 'inline',
      anchor: mountPoint,
      // Mount as the FIRST CHILD of the post card (not a sibling). Sibling
      // placement doesn't survive LinkedIn's grid / `display: contents`
      // wrappers around each feed item.
      append: 'first',
      onMount(container) {
        // Custom elements default to display:inline; force block so the
        // card below lays out cleanly.
        container.style.display = 'block';
        container.style.position = 'relative';
        container.style.zIndex = '1';
        const root = ReactDOM.createRoot(container);
        root.render(<ReaderTLDR text={text} settings={settings} autoRun={false} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    // Quick diagnostic: check the host element is actually on-screen.
    requestAnimationFrame(() => {
      const host = document.querySelector('scrollsaber-tldr:last-of-type') as HTMLElement | null;
      if (host) {
        const rect = host.getBoundingClientRect();
        const cs = getComputedStyle(host);
        log('tldr host rect', {
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          display: cs.display,
          visibility: cs.visibility,
        });
      }
    });
    log('tldr mounted', { textLen: text.length });
  } catch (e) {
    err('tldr mount failed', e);
    return;
  }

  const mountedUi = ui;
  const detach = new MutationObserver(() => {
    if (!post.isConnected) {
      mountedUi.remove();
      detach.disconnect();
    }
  });
  detach.observe(document.body, { childList: true, subtree: true });
}

async function mountModal(ctx: ContentScriptContext) {
  const ui = await createShadowRootUi(ctx, {
    name: 'scrollsaber-modal-host',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount(container) {
      const host = document.createElement('div');
      host.className = 'scrollsaber-root';
      container.appendChild(host);
      const root = ReactDOM.createRoot(host);
      root.render(<ModalApp onReady={(fn) => { openModalFn = fn; }} />);
      return root;
    },
    onRemove(root) {
      root?.unmount();
      openModalFn = null;
    },
  });
  ui.mount();
}

interface ModalAppProps {
  onReady: (open: (p: OpenPayload) => void) => void;
}

function ModalApp({ onReady }: ModalAppProps) {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [state, setState] = React.useState<OpenPayload | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getSettings().then((s) => {
      if (mounted) setSettings(s);
    });
    const unwatch = watchSettings((s) => setSettings(s));
    return () => {
      mounted = false;
      unwatch();
    };
  }, []);

  React.useEffect(() => {
    onReady((payload) => {
      log('modal open requested', { textLen: payload.text.length });
      setState(payload);
      setOpen(true);
    });
  }, [onReady]);

  return (
    <ToasterProvider>
      <ModalInner
        settings={settings}
        payload={state}
        open={open}
        onOpenChange={setOpen}
      />
    </ToasterProvider>
  );
}

function ModalInner({
  settings,
  payload,
  open,
  onOpenChange,
}: {
  settings: Settings | null;
  payload: OpenPayload | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const toaster = useToaster();

  if (!settings || !payload) {
    if (!open) return null;
    return null;
  }

  if (!hasApiKey(settings)) {
    return (
      <SetupPrompt
        open={open}
        onOpenChange={onOpenChange}
        provider={settings.provider}
      />
    );
  }

  return (
    <ShortenModal
      open={open}
      onOpenChange={onOpenChange}
      originalText={payload.text}
      platform="linkedin"
      settings={settings}
      onApply={(text, _versions: Versions, key: VersionKey) => {
        const before = getComposeText(payload.compose);
        const stack = undoStacks.get(payload.compose) ?? [];
        stack.push({ compose: payload.compose, before });
        while (stack.length > MAX_UNDO) stack.shift();
        undoStacks.set(payload.compose, stack);

        const ok = replaceComposeText(payload.compose, text);
        if (!ok) {
          toaster.push({
            variant: 'destructive',
            title: 'Apply failed',
            description: 'Could not write back to LinkedIn compose box.',
          });
          return;
        }
        focusCompose(payload.compose);

        const saved = timeSavedSeconds(before, text);
        toaster.push({
          title:
            saved > 0
              ? `Applied ${key} · readers save ~${formatDuration(saved)} each`
              : `Applied ${key}`,
          description:
            saved > 0
              ? `≈${formatDuration(impactSeconds(saved))} across ~300 viewers. Ctrl+Z in the compose box to undo.`
              : 'Use Ctrl+Z in the compose box to undo.',
        });
      }}
    />
  );
}

function SetupPrompt({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: string;
}) {
  const [imported, setImported] = React.useState<null | typeof import('@/components/ui/dialog')>(
    null,
  );
  React.useEffect(() => {
    import('@/components/ui/dialog').then(setImported);
  }, []);
  if (!imported) return null;
  const { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } =
    imported;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up your API key</DialogTitle>
          <DialogDescription>
            Scrollsaber uses your own {provider === 'gemini' ? 'Gemini' : 'Groq'} API key.
            Add it once, then shorten away.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              browser.runtime.sendMessage({ type: 'open-options' }).catch(() => {
                browser.runtime.openOptionsPage();
              });
            }}
          >
            Open Settings
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
