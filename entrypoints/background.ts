export default defineBackground(() => {
  // Open options page on first install to guide BYOK setup.
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await browser.runtime.openOptionsPage();
    }
  });

  // Content scripts cannot call runtime.openOptionsPage(); the setup prompt
  // on LinkedIn asks the background to open Settings instead.
  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = raw as { type?: unknown } | null;
    if (msg?.type === 'open-options') {
      return browser.runtime.openOptionsPage().then(() => ({ ok: true }));
    }
    return undefined;
  });

  // Forward the keyboard-command to the active LinkedIn tab.
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'open-shortener') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('linkedin.com')) return;
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'scrollsaber:open' });
    } catch {
      // Content script may not be injected on this tab — silently ignore.
    }
  });
});
