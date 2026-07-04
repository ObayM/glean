import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Glean',
    description: "Highlight a word → One click → It's in Anki",
    permissions: ['storage', 'activeTab', 'contextMenus', 'offscreen'],
    host_permissions: [
      'http://127.0.0.1:8765/*',
      'https://ai.hackclub.com/*',
      'https://openrouter.ai/*',
      'https://api.dictionaryapi.dev/*',
      'https://dictionaryapi.com/*',
      'https://media.merriam-webster.com/*',
    ],
    icons: {
      16: '/icons/icon16.png',
      32: '/icons/icon32.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
    action: {
      default_title: 'Glean',
      default_icon: {
        16: '/icons/icon16.png',
        32: '/icons/icon32.png',
        48: '/icons/icon48.png',
        128: '/icons/icon128.png',
      },
    },
  },
});
