# Changelog

All notable changes to PG Patrol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-03-18

### Changed

- Throttle badge updates (500 ms) to reduce chrome.action churn
- Batch activity log entries via LOG_ACTIVITY_BATCH message type
- Single read-modify-write cycle for stat persistence (debounced StatAccumulator)

### Fixed

- WeakMap for original-text and skip-tag caches (eliminates memory leak on long-lived tabs)
- `willReadFrequently` canvas hint suppresses Canvas2D readback warning
- NSFW source URL now correctly recorded in batched activity logging

## [1.4.0] - 2026-03-18

### Added

- Debounced StatAccumulator with 5-second flush for live popup stats
- Navigation detection to reset per-page counters on SPA route changes
- LOG_ACTIVITY_BATCH message type for bulk activity log writes
- Remotion video infrastructure and demo recording pipeline

### Changed

- Extract skip-tags to shared module (`src/shared/skip-tags.ts`)
- LRU-bounded image classification cache (prevents unbounded memory growth)

## [1.3.0] - 2026-03-17

### Changed

- SVG logo text converted to paths (renders identically without custom fonts)
- Remove feDropShadow filter from logo (cleaner rendering)
- Inline hero SVG on landing page (eliminates external asset load)

### Added

- `generate-icons` npm script for regenerating extension icons from SVG source

## [1.2.0] - 2026-03-17

### Added

- Stock photo replacements: 60 bundled WebP images (cute animals + food, 600 px)
- 3-tier image fallback: IndexedDB-cached data URIs → bundled WebP assets → SVG banner
- Pexels CDN caching with daily rotation for online mode
- Aspect-ratio matching for seamless layout preservation
- Neutral alt text on replacement images

### Changed

- 908 tests across 46 suites

## [1.1.0] - 2026-03-16

### Fixed

- Instagram video playback regression (videos were permanently hidden by image scanner)

### Changed

- Image Filtering labeled "Research Preview" in popup UI

## [1.0.0] - 2026-03-16

### Added

- Text filtering engine with funny word replacements
- Image detection and blocking using local ViT-Tiny ONNX model
- Good Vibes mode for softening distress-heavy content
- ML text classification using MiniLMv2 Jigsaw model via Transformers.js
- Chrome Built-in AI (Gemini Nano) integration for borderline text refinement on Chrome 131+ (silent fallback on other browsers)
- Custom n-gram and Bayesian text scoring
- Real-time DOM monitoring with MutationObserver and IntersectionObserver
- Web Worker for off-main-thread text processing
- Multi-crop inference for ambiguous image scores
- Pre-blur CSS injection at document_start
- Three sensitivity levels: Mild, Moderate, Strict
- Custom blocked words and safe words
- Site whitelisting
- Per-page activity log (ring buffer, max 50 entries)
- All-time stats tracking (words replaced, images blocked)
- Reveal toggle to temporarily view original content
- Optional Perspective API integration (opt-in)
- Chrome MV3 build with offscreen document for ML inference
- Firefox MV3 build with background page for ML inference
- Cross-browser support: Chrome, Firefox, Edge, Brave, Opera, Arc
- 875+ unit tests (Jest) and E2E tests (Playwright)
- Automated release workflow via GitHub Actions
- Privacy-first design: all core filtering runs on-device

[1.5.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.5.0
[1.4.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.4.0
[1.3.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.3.0
[1.2.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.2.0
[1.1.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.1.0
[1.0.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.0.0
