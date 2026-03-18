<p align="center">
  <img src="./store-assets/pg-patrol-banner.gif" alt="PG Patrol — Let them explore. We'll keep it clean." width="800" />
</p>

# PG Patrol — Parental Control Browser Extension

**Family-friendly web filter — replaces profanity with funny words, hides NSFW images, and softens distress-heavy content. All AI runs locally on your device.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-924%2B-brightgreen.svg)](./tests)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4.svg?logo=googlechrome&logoColor=white)](#browser-compatibility)
[![Firefox MV3](https://img.shields.io/badge/Firefox-MV3-FF7139.svg?logo=firefox&logoColor=white)](#browser-compatibility)
[![Privacy](https://img.shields.io/badge/privacy-100%25_local-8B5CF6.svg)](#privacy)

<!-- Launch video: store-assets/pg-patrol-launch.mp4 — upload to a GitHub issue/PR to embed, or view at https://github.com/nareshnavinash/pg-patrol/releases -->

---

## Table of Contents

- [Features](#features)
- [Browser Compatibility](#browser-compatibility)
- [Installation](#installation)
- [Usage](#usage)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Development](#development)
- [Privacy](#privacy)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Profanity Filter** — Replaces swear words with funny, family-friendly alternatives
- **NSFW Image Blocker** — Detects and silently replaces explicit images with pleasant stock photos (cute animals, food) using a local AI model (ViT-Tiny ONNX)
- **Good Vibes Mode** — Softens distress-heavy content blocks with a gentle overlay
- **Real-Time Protection** — Works on dynamic pages: social feeds, infinite scroll, lazy-loaded images, comment sections
- **ML Text Toxicity** — 6-label Jigsaw toxicity model (MiniLMv2) for borderline content classification
- **Custom Word Lists** — Add your own blocked words, safe words, and negative triggers
- **Site Whitelisting** — Skip filtering on trusted sites
- **Sensitivity Levels** — Mild, Moderate, or Strict
- **Activity Log** — Per-page log of what was filtered
- **Stats Tracking** — All-time counts of words replaced and images hidden
- **Chrome AI Boost** — On Chrome 131+, borderline text classifications refined by Gemini Nano (fully local, silent fallback on other browsers)
- **Reveal Toggle** — Temporarily view original content
- **Silent Replacement** — Blocked images are replaced with cute animals and mouth-watering food photos instead of obvious "blocked" banners — no curiosity spikes
- **Offline Ready** — 60 bundled replacement images (WebP, 600px) ensure coverage even without internet; online mode caches more from Pexels CDN
- **Privacy-First** — All core filtering runs locally; no data sent to servers

---

## Why PG Patrol?

| Feature            | PG Patrol               | Typical Web Filters    |
| ------------------ | ----------------------- | ---------------------- |
| Data privacy       | 100% on-device          | Cloud-based scanning   |
| Profanity handling | Funny words             | Asterisks or blanks    |
| NSFW detection     | Local AI model          | Cloud API or blocklist |
| Blocked images     | Cute animal/food photos | Scary warning banners  |
| Cost               | Free, open source       | $3-10/month            |
| Browsers           | 6 browsers              | Usually Chrome only    |

---

## Browser Compatibility

| Browser         | Install From                                                            | Status    |
| --------------- | ----------------------------------------------------------------------- | --------- |
| Google Chrome   | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |
| Microsoft Edge  | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |
| Mozilla Firefox | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |
| Brave           | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |
| Opera           | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |
| Arc             | [GitHub Releases](https://github.com/nareshnavinash/pg-patrol/releases) | Supported |

Chrome, Edge, Brave, Opera, and Arc use the same Chromium MV3 package. Firefox uses a dedicated build with a different background architecture (background page instead of offscreen document).

---

## Installation

### Option 1: From GitHub Releases (Recommended)

1. Go to the [Releases](../../releases) page
2. Download the `.zip` for your browser (`pg-patrol-chrome.zip` or `pg-patrol-firefox.zip`)
3. Unzip the file
4. Load it in your browser (see [Loading the Extension](#loading-the-extension) below)

### Option 2: Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 9 or later

#### Steps

```bash
# 1. Clone the repository
git clone https://github.com/nareshnavinash/pg-patrol.git
cd pg-patrol

# 2. Install dependencies
npm install

# 3. Build for your browser
npm run build:chrome    # Chrome, Edge, Brave, Opera, Arc
npm run build:firefox   # Firefox
```

Build output:

- Chrome: `dist/`
- Firefox: `dist-firefox/`

### Loading the Extension

#### Chrome / Edge / Brave / Opera

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, `opera://extensions`)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder

#### Arc

1. Open `arc://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` folder

#### Firefox

**Option A — Temporary install (resets on browser restart):**

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file inside `dist-firefox/`

**Option B — Dev mode with auto-reload:**

```bash
npm run firefox:dev
```

This builds the extension and launches Firefox with it loaded using `web-ext`.

#### Pin the Extension

After loading, pin PG Patrol to your browser toolbar for easy access.

---

## Usage

1. Click the **PG Patrol** icon in the toolbar to open the popup
2. Use the **main toggle** to enable or disable filtering globally
3. Choose what to filter:
   - **Text filtering** — profanity replacement
   - **Image filtering** — NSFW image detection
   - **Good Vibes mode** — distress-heavy content softening
4. Adjust **sensitivity** (Mild / Moderate / Strict) to control how aggressively content is filtered
5. Add **custom blocked words** or **safe words** under Custom Words
6. **Whitelist** sites you trust under Site Manager
7. Use the **Reveal toggle** to temporarily view original content
8. Check the **Activity Log** to see what was filtered on the current page

---

## Tech Stack

| Layer              | Technology                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| UI Framework       | [Preact](https://preactjs.com/)                                                             |
| Styling            | [Tailwind CSS](https://tailwindcss.com/) v4                                                 |
| Language           | TypeScript (strict mode)                                                                    |
| Build Tool         | [Vite](https://vitejs.dev/) + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) (Chrome)  |
| NSFW Detection     | [ONNX Runtime Web](https://onnxruntime.ai/) (ViT-Tiny, WASM backend)                        |
| Text Toxicity      | [Transformers.js](https://huggingface.co/docs/transformers.js) (MiniLMv2-toxic-jigsaw)      |
| Profanity Engine   | [@2toad/profanity](https://github.com/2toad/Profanity) + custom n-gram/Bayes scoring        |
| Chrome Built-in AI | [Gemini Nano](https://developer.chrome.com/docs/ai/built-in) (Chrome 131+, silent fallback) |
| Testing            | [Jest](https://jestjs.io/) (unit) + [Playwright](https://playwright.dev/) (E2E)             |
| Extension Manifest | Manifest V3                                                                                 |

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│ Content       │     │ Background        │     │ Offscreen Doc     │
│ Scripts       │────>│ Service Worker    │────>│ (Chrome only)     │
│               │<────│                   │<────│                   │
│ - Text filter │     │ - Message routing │     │ - ML inference    │
│ - Image scan  │     │ - Tab stats       │     │ - ONNX NSFW model │
│ - DOM observer│     │ - Activity log    │     │ - Transformers.js │
│ - Web Worker  │     │ - Offscreen mgmt  │     │ - Idle timeout    │
└──────────────┘     └──────────────────┘     └───────────────────┘
                            │
                     ┌──────┴──────┐
                     │ Popup UI    │
                     │ (Preact)    │
                     │ - Settings  │
                     │ - Stats     │
                     │ - Log       │
                     └─────────────┘
```

**Firefox difference:** No offscreen document. The ML inference engine runs directly in the background page (Firefox MV3 background pages have a full DOM context).

### Key Design Decisions

- **Pre-blur CSS** — Injected at `document_start` to blur all images before page renders. Removed after classification completes.
- **Silent image replacement** — Blocked NSFW images are replaced with pleasant stock photos (cute animals, food) matched by aspect ratio. 3-tier fallback: IndexedDB-cached data URIs > bundled WebP assets > SVG banner.
- **Web Worker** — Text filtering (profanity + negative content scoring) runs off the main thread.
- **Multi-crop inference** — Ambiguous NSFW scores (0.2-0.7) trigger a second pass with a 2x zoomed center crop.
- **Tiered text classification** — Keyword score > 0.06 blocks immediately; 0.015-0.06 goes to ML classifier; < 0.015 allows immediately.
- **Ring buffer activity log** — Max 50 entries per tab, cleaned up on tab close.
- **Chrome AI Tier 2** — Borderline text (keyword score 0.015–0.06) that passes the ML classifier is optionally refined by Chrome's built-in Gemini Nano on supported browsers; all other browsers silently skip this step.
- **Debounced stat persistence** — StatAccumulator batches popup stat updates with a 5-second flush to reduce storage writes.

---

## Development

### Scripts

```bash
npm run dev              # Vite dev server (Chrome, with HMR)
npm run build            # Build for Chrome (alias for build:chrome)
npm run build:chrome     # Build for Chrome / Edge / Brave / Opera / Arc
npm run build:firefox    # Build for Firefox
npm run test             # Run unit tests (Jest)
npm run test:watch       # Run tests in watch mode
npm run e2e              # Run E2E tests (Playwright)
npm run e2e:headed       # Run E2E tests with visible browser
npm run package:chrome   # Build + zip for Chrome Web Store
npm run package:firefox  # Build + zip for Firefox Add-ons
npm run firefox:dev      # Build + launch Firefox with extension loaded
npm run clean            # Remove build output and zip files
```

### Project Structure

```
src/
├── background/
│   ├── index.ts              # Chrome background service worker
│   └── index.firefox.ts      # Firefox background page (with direct ML inference)
├── content/
│   ├── pre-blur.ts           # Early CSS injection (document_start)
│   ├── index.ts              # Main content script (text + image filtering)
│   ├── filter-worker.ts      # Web Worker for off-thread text processing
│   ├── filter-worker-proxy.ts# Worker communication proxy
│   ├── image-scanner.ts      # NSFW image detection pipeline
│   ├── replacement-images.ts # Stock photo selection (3-tier fallback)
│   ├── dom-walker.ts         # DOM text node traversal
│   ├── observer.ts           # MutationObserver for dynamic content
│   └── ...
├── ml-inference/
│   ├── inference-engine.ts   # Shared ML logic (used by both Chrome + Firefox)
│   ├── offscreen.ts          # Chrome offscreen document (imports inference-engine)
│   └── offscreen.html        # Offscreen document container
├── popup/
│   ├── App.tsx               # Main popup component
│   ├── components/           # UI components (Header, Settings, etc.)
│   ├── hooks/                # Custom hooks (useStorage, useCurrentTab, etc.)
│   ├── main.tsx              # Popup entry point
│   └── index.html            # Popup HTML
├── shared/
│   ├── types.ts              # TypeScript interfaces and message types
│   ├── storage.ts            # Chrome storage API wrapper
│   ├── profanity-engine.ts   # Text profanity detection + replacement
│   ├── nsfw-detector.ts      # NSFW image detection coordinator
│   ├── ml-text-classifier.ts # ML toxicity classification
│   ├── bayes-scorer.ts       # Bayesian text classifier
│   ├── chrome-ai.ts          # Chrome Built-in AI (Gemini Nano) integration
│   ├── skip-tags.ts          # Shared skip-tag definitions for DOM walker
│   └── ...
├── assets/
│   ├── icons/                # Extension icons (16, 32, 48, 128)
│   ├── models/               # ONNX NSFW model (nsfw.onnx)
│   ├── ml-models/            # Transformers.js text toxicity model
│   ├── cartoons/             # Placeholder SVGs for blocked images
│   └── replacements/         # 60 bundled stock photos (animals + food, WebP)
├── data/                     # Curated CDN URLs + JSON word lists
├── manifest.ts               # Chrome manifest (MV3)
└── styles/
    └── global.css

tests/                        # Jest unit tests + Playwright E2E tests
vite.config.ts                # Chrome build config
vite.config.firefox.ts        # Firefox build config
store-assets/                 # Store listing descriptions
```

### Running Tests

```bash
# Unit tests (924 tests across 47 suites)
npm test

# With coverage
npx jest --coverage

# E2E tests
npm run e2e
```

---

## Privacy

PG Patrol is designed with a privacy-first approach:

- **All core filtering happens locally** — text, images, and content scoring never leave your device
- **No analytics or tracking** — no telemetry, no data collection
- **No external API calls** by default
- **Optional** Perspective API integration (opt-in, requires your own API key)

### Permissions Explained

| Permission                | Why                                                                   |
| ------------------------- | --------------------------------------------------------------------- |
| `storage`                 | Save your settings and preferences                                    |
| `activeTab`               | Access the current tab for filtering                                  |
| `alarms`                  | Schedule periodic word list and replacement image updates (every 24h) |
| `offscreen` (Chrome only) | Run AI models in an isolated background context                       |
| `<all_urls>`              | Inject content scripts to filter pages you visit                      |

For full details, see [PRIVACY.md](./PRIVACY.md).

---

## FAQ

**Does PG Patrol send my data to a server?**
No. All core filtering runs locally. The optional Perspective API is separate and opt-in only.

**Does it work on dynamic pages (infinite scroll, social feeds)?**
Yes. PG Patrol uses MutationObserver and IntersectionObserver to continuously scan new content as it appears.

**Why does it need access to all URLs?**
It's a content filter — it needs to read and modify text/images on any page you visit. No content is transmitted anywhere.

**Can I install it without the browser store?**
Yes. See the [Installation](#installation) section for building from source or loading from a release zip.

**Does it work on Firefox?**
Yes. Firefox 121+ is supported with a dedicated build (`npm run build:firefox`).

**Is it perfect?**
No filter is perfect. PG Patrol significantly reduces unwanted exposure but some content may slip through or be over-filtered. Adjust sensitivity and custom word lists for the best experience.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit and push
6. Open a Pull Request

For build details, see [BUILD.md](./BUILD.md).

---

## License

This project is licensed under the [MIT License](./LICENSE).
