# PG Patrol — Privacy Policy

**Last updated:** March 2026

## Overview

PG Patrol is a browser extension that filters profanity and optionally detects NSFW images on web pages. We are committed to protecting your privacy.

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

## Chrome Storage

PG Patrol uses Chrome's built-in storage API (`chrome.storage.sync`) to save your settings (toggle states, sensitivity level, whitelisted sites). This data:

- Is stored locally in your browser
- May sync across your Chrome instances if you have Chrome Sync enabled
- Contains no personal information — only your extension preferences

## Permissions

PG Patrol requires the following browser permissions:

- **storage**: To save your settings and preferences
- **activeTab**: To access the current tab for filtering
- **host_permissions (all URLs)**: To inject the content script that performs text/image filtering on web pages

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.
