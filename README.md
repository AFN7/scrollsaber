# Scrollsaber

> Cut the scroll. Not the point.

[**Install from Chrome Web Store →**](https://chromewebstore.google.com/detail/scrollsaber/lfmlkjabnmgbojbhdhnddlbjdppjbeoo)

A Chrome extension (MV3) that shortens long LinkedIn posts without losing meaning. You write → click the saber button → pick a length on the slider (75% / 50% / 25% / single sentence) → apply. Runs fully client-side via your own LLM API key. No backend. No tracking.

It also adds a TL;DR bar above long feed posts so you can skim before committing to read.

## Features

- **Compose mode**: shortens what you're typing into LinkedIn's compose box
- **Reader mode**: TL;DR button on long feed posts (off by default for posts under 100 chars)
- **BYOK** — your key, your account, your rate limits
- **Local cache** (24 h) so re-opening the modal doesn't burn tokens
- **Daily credit cap** to protect free-tier quotas
- **Undo-last** — Ctrl+Z restores the original draft

## Supported providers

Pick one in Settings:

- **Google Gemini** — native API (free tier)
- **OpenAI-compatible** — any base URL with `/chat/completions`. Built-in presets:
  - Groq · Llama 3.3 70B
  - OpenRouter (100+ models, free + paid)
  - DeepSeek
  - Cerebras
  - Together AI
  - Fireworks
  - Custom (any URL — needs you to grant the host permission via Chrome)

Same modal, same cache, same prompt — just point it at whichever API you have a key for.

## Stack

- [WXT](https://wxt.dev) (Vite + MV3)
- React 18 + TypeScript strict
- Tailwind v3, shadcn-style primitives on Radix UI
- Vitest for unit tests

## Develop

```bash
pnpm install                 # one-time; also runs `wxt prepare`
pnpm dev                     # live-reload Chrome extension
pnpm test                    # vitest
pnpm compile                 # tsc --noEmit
pnpm build                   # production build → .output/chrome-mv3
pnpm zip                     # .output/scrollsaber-0.1.0-chrome.zip
```

Load the unpacked extension from `.output/chrome-mv3` in `chrome://extensions`.

## Configure

Open the options page (toolbar icon → gear). Drop in a key:

- Gemini: <https://aistudio.google.com/apikey>
- Groq: <https://console.groq.com/keys>
- OpenRouter: <https://openrouter.ai/keys>
- DeepSeek: <https://platform.deepseek.com/api_keys>
- …or any OpenAI-compatible endpoint

Pick provider, optional language, accent color, daily credit cap, reader-mode threshold. "Test connection" verifies it before you rely on it.

## Keyboard shortcut

`Ctrl+Shift+S` (or `⌘+Shift+S` on Mac) inside a focused LinkedIn compose box opens the modal.

## Architecture

```
entrypoints/
  background.ts         # MV3 service worker + keyboard command relay
  content.ts            # content script entry (document_idle, *.linkedin.com)
  popup/                # toolbar dashboard (lifetime stats + today's cap)
  options/              # provider selection, presets, BYOK, defaults

lib/
  llm/
    prompt.ts           # buildSystemPrompt(platform) — per-platform prompts
    gemini.ts           # Gemini native adapter
    openai.ts           # generic OpenAI-compatible adapter (Groq, OpenRouter, …)
    presets.ts          # provider preset catalog
    client.ts           # provider dispatch + retryable fallback + cache
    validator.ts        # JSON-shape validation of model output
  linkedin/
    dom.ts              # semantic selectors + execCommand writeback
    feed.ts             # feed-post detection + text extraction
    observer.ts         # MutationObserver for SPA nav + shadow DOM
    query.ts            # queryAllDeep — recursive shadow/iframe traversal
    injector.tsx        # React mounting: button + modal in shadow roots
  storage/
    settings.ts         # provider config, BYOK, defaults
    stats.ts            # rolling 30 d window + daily window + totals
    cache.ts            # sha256-keyed 24 h cache
  credits/
    policy.ts           # TOKENS_PER_CREDIT, tier thresholds, length limits
    estimator.ts        # pre-request credit estimate
  time/
    calculator.ts       # reading-time math (200 WPM baseline)

components/
  ShortenModal.tsx      # idle/confirm/loading/ready/error state machine
  VersionSlider.tsx     # 4-stop snap slider
  PreviewPanel.tsx      # read-only text + char count
  CreditEstimateBadge.tsx
  ReaderTLDR.tsx        # feed-post TL;DR component
  ScrollsaberButton.tsx # injected ⚔ trigger
  ui/                   # Radix-based primitives (button, dialog, slider, toast)
```

## Privacy

- API keys live in `chrome.storage.local`. They're never logged, never shipped to any host other than the provider you picked.
- Post content goes only to the provider you configured.
- Shortened text is written into LinkedIn's Quill editor via `execCommand('insertText')` (plain text, never HTML).
- LLM responses are JSON-validated; malformed output surfaces as an error, never a crash.
- Cache keys are `sha256(input-json)`; the raw post is only stored inside the cache value.
- No analytics, no telemetry. Nothing leaves your browser except the API call you made.

## Credit model

```
credits = ceil((inputTokens + outputTokens) / 1000)
```

Post-request, the actual `usageMetadata` (Gemini) / `usage` (OpenAI-compatible) drives stats. Daily cap is enforced **before** sending; cache hits and failed requests consume 0 credits.

| Bucket       | Credits | Badge |
| ------------ | ------- | ----- |
| Typical post | 1–3     | green |
| Long post    | 4–10    | yellow |
| Heavy post   | 11+     | red   |

Hard limits:
- Post > 30 000 chars → refused
- Post > 15 000 chars → confirm dialog
- Post < 20 chars → inline hint, no API call

## Testing

```bash
pnpm test
```

Unit coverage: reading-time math, credit formula + language detection, LLM JSON validator, per-platform system prompt builder.

## License

MIT — see [`LICENSE`](LICENSE). Built by [Afan Selçuk](https://github.com/AFN7).
