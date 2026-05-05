import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  outDir: '.output',
  manifest: {
    name: 'Scrollsaber',
    description: 'Cut long posts. Keep the point. LinkedIn shortening with AI (BYOK).',
    version: '0.1.0',
    permissions: ['storage'],
    // Each entry shows up in the install prompt. Keeping this list curated to
    // the OpenAI-compatible providers we ship presets for. Users who add a
    // custom URL can grant access via Chrome's optional permission flow
    // (handled at runtime by the Options page; see optional_host_permissions).
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      'https://api.groq.com/*',
      'https://openrouter.ai/*',
      'https://api.deepseek.com/*',
      'https://api.cerebras.ai/*',
      'https://api.together.xyz/*',
      'https://api.fireworks.ai/*',
    ],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: {
      default_title: 'Scrollsaber',
    },
    commands: {
      'open-shortener': {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: 'Open Scrollsaber on the current compose box',
      },
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    web_accessible_resources: [
      {
        resources: ['icon/*.png', 'content-scripts/*.css', 'assets/*'],
        matches: ['https://*.linkedin.com/*'],
      },
    ],
  },
  vite: () => ({
    build: {
      sourcemap: false,
    },
  }),
});
