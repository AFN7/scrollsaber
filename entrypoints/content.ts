import { mountLinkedInInjector } from '@/lib/linkedin/injector';
import { log, err } from '@/lib/debug';
import '@/assets/tailwind.css';

export default defineContentScript({
  matches: ['https://*.linkedin.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    log('content script loaded', { url: location.pathname, readyState: document.readyState });
    try {
      await mountLinkedInInjector(ctx);
      log('injector mounted');
    } catch (e) {
      err('injector failed to mount', e);
    }
  },
});
