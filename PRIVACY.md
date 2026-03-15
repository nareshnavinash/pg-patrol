# PG Patrol — Privacy Policy

**Last updated:** March 2026

## Overview

PG Patrol is a browser extension that filters profanity, detects NSFW images, and softens distress-heavy content on web pages. We are committed to protecting your privacy.

## Data Collection

**PG Patrol does NOT collect, store, or transmit any personal data.**

- All text filtering happens entirely on your device using local algorithms
- All image detection happens entirely on your device using a local machine learning model
- No browsing data, page content, or personal information is ever sent to our servers
- We do not use analytics, tracking pixels, or any form of telemetry

## Optional Perspective API

If you choose to enable the optional Perspective API integration:

- Text snippets are sent to Google's Perspective API for enhanced toxicity detection
- This is **entirely opt-in** and disabled by default
- You must provide your own API key to enable this feature
- Please refer to [Google's Privacy Policy](https://policies.google.com/privacy) for how Google handles data sent to the Perspective API

## Browser Storage

PG Patrol uses the browser's built-in storage API (`chrome.storage.sync` / `browser.storage.sync`) to save your settings (toggle states, sensitivity level, whitelisted sites). This data:

- Is stored locally in your browser
- May sync across your browser instances if you have sync enabled
- Contains no personal information — only your extension preferences

## Permissions

PG Patrol requires the following browser permissions:

- **storage**: To save your settings and preferences
- **activeTab**: To access the current tab for filtering
- **alarms**: To schedule periodic background tasks (e.g. updating word lists every 24 hours)
- **offscreen** (Chrome only): To run local AI/ML models (text toxicity and NSFW image detection) in an isolated background context using WebAssembly
- **host_permissions (all URLs)**: To inject the content script that performs text/image filtering on web pages

### Why `<all_urls>`?

PG Patrol needs access to all URLs because it is a content filter — it must be able to read and modify page content (text and images) on any website you visit. Without this permission, the extension would not be able to protect you on pages outside a fixed allowlist.

**Important:** This permission is used solely for local content filtering. No page content is transmitted to any server.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.
