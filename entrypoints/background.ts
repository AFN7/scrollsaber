export default defineBackground(() => {
  // Open options page on first install to guide BYOK setup.
  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      await browser.runtime.openOptionsPage();
    }
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
