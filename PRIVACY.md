# Privacy Policy

**Effective date:** 2026-05-05
**Extension:** Scrollsaber (Chrome MV3)
**Maintainer:** Afan Selçuk — <afanselcuk@gmail.com>

Scrollsaber is a Chrome extension that shortens LinkedIn posts using an LLM API key the user provides. There is no backend operated by the maintainer.

## What Scrollsaber collects

**Nothing.** The maintainer has no servers, no analytics, no telemetry, and no way to observe how anyone uses the extension.

## What Scrollsaber stores locally

The following data is stored in `chrome.storage.local` on the user's device and never leaves the device:

- The user's API key(s) for whichever provider they configured (Google Gemini and/or any OpenAI-compatible endpoint such as Groq, OpenRouter, DeepSeek, Cerebras, Together AI, Fireworks, or a custom URL the user entered)
- The user's preferences: chosen provider, base URL, model name, default language, accent color, daily credit cap, reader-mode threshold
- Anonymous usage stats: post-shortened count, credit-consumption rolling totals, reading-time saved (no post content)
- A 24-hour cache of previously shortened post text so that re-opening the modal on the same draft does not consume additional tokens. Cache entries auto-expire after 24 hours.

The user can clear all of this via Settings → Danger zone, or by uninstalling the extension.

## What Scrollsaber sends to third parties

When the user clicks the Scrollsaber button to shorten a post (or when the reader-mode TL;DR runs on a feed item), Scrollsaber sends an HTTPS request to the LLM provider the user configured. The request contains:

- The text of the user's post draft (or the feed post being summarized)
- The user's API key (in the request headers or URL, as required by the provider)
- A small system prompt telling the model how to format its output

The destination of that request is whichever provider the user picked — for example `generativelanguage.googleapis.com` for Gemini, `api.groq.com` for Groq, `openrouter.ai` for OpenRouter, etc. That request is governed by **the privacy policy of the provider the user chose**, not by the maintainer of Scrollsaber. Scrollsaber does not see, log, intercept, or proxy this traffic.

## Permissions explained

- `storage` — stores settings, stats, and cache locally as described above.
- Host permissions for the bundled providers — required for the extension to make API requests directly from the browser to the chosen LLM provider.
- Optional host permissions (`https://*/*`, `http://*/*`) — granted only when the user explicitly enters a custom OpenAI-compatible URL and accepts Chrome's permission prompt. Chrome itself shows the prompt before the extension can reach that URL.

## Data sale

Scrollsaber does not sell or share user data. There is no data to sell — none reaches the maintainer.

## Children

Scrollsaber is not directed at children under 13. The extension performs the same operation regardless of who is using it and does not collect age information.

## Changes

If this policy changes, the updated version will be committed to the public source repository at <https://github.com/AFN7/scrollsaber/blob/main/PRIVACY.md> with a new "Effective date".

## Contact

- Email: afanselcuk@gmail.com
- Issues: <https://github.com/AFN7/scrollsaber/issues>
- Source code: <https://github.com/AFN7/scrollsaber>
