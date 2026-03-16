# Build Instructions

These instructions explain how to build PG Patrol from source for development, testing, or sideloading.

## Prerequisites

- Node.js 20 or later
- npm 9 or later

## Setup

```bash
npm install
```

## Build for Chrome / Edge

```bash
npm run build:chrome
```

Output: `dist/` directory containing the Chrome/Edge MV3 extension.

## Build for Firefox

```bash
npm run build:firefox
```

Output: `dist-firefox/` directory containing the Firefox MV3 extension.

## Package for Submission

```bash
# Chrome Web Store / Edge Add-ons
npm run package:chrome
# → pg-patrol-chrome.zip

# Firefox Add-ons (AMO)
npm run package:firefox
# → pg-patrol-firefox.zip
```

## Verify

```bash
# Run unit tests
npm test

# Lint Firefox extension (checks manifest, permissions, etc.)
npx web-ext lint --source-dir dist-firefox/

# Test Firefox extension locally
npm run firefox:dev
```

## Project Structure

- `src/` — TypeScript source code
- `src/manifest.ts` — Chrome/Edge manifest (processed by @crxjs/vite-plugin)
- `vite.config.ts` — Chrome/Edge build configuration
- `vite.config.firefox.ts` — Firefox build configuration (inline manifest)
- `src/background/index.ts` — Chrome background service worker
- `src/background/index.firefox.ts` — Firefox background page (includes ML inference)
- `src/ml-inference/inference-engine.ts` — Shared ML inference logic
- `src/ml-inference/offscreen.ts` — Chrome offscreen document for ML (uses inference-engine)
- `src/content/` — Content scripts (shared between Chrome and Firefox)
- `src/popup/` — Extension popup UI (Preact + Tailwind)
- `src/assets/models/` — ONNX NSFW image model
- `src/assets/ml-models/` — Transformers.js text toxicity model

## Architecture Differences

|                    | Chrome / Edge                                   | Firefox                           |
| ------------------ | ----------------------------------------------- | --------------------------------- |
| Background context | Service Worker                                  | Background Page                   |
| ML inference       | Offscreen document (message-passing)            | Direct call in background page    |
| Offscreen API      | Required (`chrome.offscreen`)                   | Not available; not needed         |
| Content scripts    | Classic scripts (bundled by @crxjs/vite-plugin) | Classic script loader + ES module |
