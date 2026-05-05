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
    // Each entry shows up in the install prompt. Curated to the providers
    // we ship presets for. Custom URLs are accepted in Settings but only
    // reach providers covered here; broader runtime grants will land in v0.2.
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      'https://api.groq.com/*',
      'https://openrouter.ai/*',
      'https://api.deepseek.com/*',
      'https://api.cerebras.ai/*',
      'https://api.together.xyz/*',
      'https://api.fireworks.ai/*',
    ],
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
