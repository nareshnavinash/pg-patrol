# Changelog

All notable changes to PG Patrol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-16

### Added

- Text filtering engine with funny word replacements
- Image detection and blocking using local ViT-Tiny ONNX model
- Good Vibes mode for softening distress-heavy content
- ML text classification using MiniLMv2 Jigsaw model via Transformers.js
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
- 750+ unit tests (Jest) and E2E tests (Playwright)
- Automated release workflow via GitHub Actions
- Privacy-first design: all core filtering runs on-device

[1.0.0]: https://github.com/nareshnavinash/pg-patrol/releases/tag/v1.0.0
