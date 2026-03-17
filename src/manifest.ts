import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'PG Patrol',
  version: '1.3.0',
  description:
    'Free parental control web filter — replaces profanity with funny words, blocks NSFW images using on-device AI',
  permissions: ['storage', 'activeTab', 'alarms', 'offscreen'],
  host_permissions: ['<all_urls>'],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'src/assets/icons/icon-16.png',
      '32': 'src/assets/icons/icon-32.png',
      '48': 'src/assets/icons/icon-48.png',
      '128': 'src/assets/icons/icon-128.png',
    },
  },
  icons: {
    '16': 'src/assets/icons/icon-16.png',
    '32': 'src/assets/icons/icon-32.png',
    '48': 'src/assets/icons/icon-48.png',
    '128': 'src/assets/icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module' as const,
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/pre-blur.ts'],
      run_at: 'document_start',
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_end',
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
  },
  web_accessible_resources: [
    {
      resources: ['src/assets/cartoons/*'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['assets/models/*'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['assets/ml-models/**/*'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['filter-worker.js'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['src/assets/replacements/**/*'],
      matches: ['<all_urls>'],
    },
  ],
});
