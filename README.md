# PG Patrol: Protect Your Kids from Accidental Exposure to 18+ and Distress-Heavy Content in Chrome

**Protect your kids from accidental exposure to 18+ content or distress-heavy content in the browser.**

PG Patrol is a family-focused Chrome extension built for one main purpose: helping parents and families reduce surprise exposure to explicit images, harsh language, and emotionally heavy content while browsing. If you are looking for a Chrome extension to block NSFW images, a safe browsing extension for kids, a family web filter for Chrome, or a browser tool that helps protect children from adult or distressing content, PG Patrol is built for that exact use case.

PG Patrol works while pages load, while you scroll, and while new content appears on dynamic sites. That matters because accidental exposure usually does not happen on neat, static pages. It happens in live feeds, image grids, social platforms, comment sections, search results, and fast-moving websites where new content keeps appearing.

## What PG Patrol Does

PG Patrol helps create a safer browsing experience for kids and families by handling three main types of content:

- Profanity and offensive wording
- NSFW or sexual images
- Negative, toxic, or distress-heavy text blocks

The goal is simple: let children and families keep using the modern web without being unexpectedly interrupted by explicit thumbnails, adult-style imagery, harsh language, or emotionally intense content they were not trying to find.

## Why Families Use PG Patrol

PG Patrol is especially useful when:

- Kids use a shared family laptop
- Parents want a safer Chrome experience for children
- Students browse on school or home devices
- Families want fewer explicit surprises on social media or search pages
- Parents want help reducing doom-heavy or distress-heavy browsing
- Adults want a calmer browsing experience for themselves too

This is not just a profanity replacer. It is a real-time browser safety layer designed around accidental exposure prevention.

## Why Accidental Exposure Happens Online

Kids do not need to actively search for explicit or upsetting content to encounter it.

- Social feeds can load new media without warning
- Image search pages can mix safe and unsafe thumbnails
- News pages can surface graphic or distress-heavy headlines
- Comment sections can introduce profanity or toxic language
- Infinite scroll pages keep adding new content after the page first opens

PG Patrol is designed for that exact reality. It keeps working after the initial page load so protection is not limited to the first few items on screen.

## Real-Time Use Cases

One of the most important things about PG Patrol is that it is designed for live browsing, not just one-time page cleanup.

### Real-time protection on social media

When a child scrolls through a fast-moving feed, new posts and images can appear continuously. PG Patrol is built to keep up with that flow and keep scanning as content arrives.

### Real-time image protection for kids

If a page loads new images while you scroll, PG Patrol can evaluate them as they appear. Safe images are shown normally. NSFW or 18+ images are hidden and replaced with a clear PG Patrol banner.

### Real-time text cleanup for shared browsing

Comments, captions, threads, article bodies, and other text content can be filtered while the page is open, so offensive wording is softened without requiring a refresh.

### Real-time reduction of distress-heavy content

For families who want a less intense web experience, PG Patrol can also soften distress-heavy blocks of content, helping reduce the shock factor of negative news, toxic discussion, and emotionally overwhelming browsing.

## Main Features

### 1. Profanity filter for Chrome

PG Patrol can replace swear words and offensive language with safer alternatives so pages feel more family friendly without fully breaking the flow of reading.

### 2. NSFW and 18+ image blocker for Chrome

PG Patrol detects unsafe images and hides them from view. Instead of leaving explicit or sexual imagery visible, it replaces those images with a PG Patrol banner so the page remains readable and structured.

### 3. Safe image reveal flow

Images are treated cautiously while they are being checked. Safe images are allowed through. Unsafe ones stay hidden.

### 4. Positive browsing mode

PG Patrol can also detect harmful or distressing content patterns and place a softer overlay over those sections, helping create a calmer online experience.

### 5. Custom blocked words

You can add your own words or phrases you do not want to see.

### 6. Custom safe words and safe context

You can also prevent over-filtering by allowing specific words or contexts that should stay visible.

### 7. Site management

If there are websites you never want filtered, you can whitelist them.

### 8. Sensitivity settings

You can choose how strict the filtering should be:

- Mild
- Moderate
- Strict

### 9. Per-page and all-time stats

PG Patrol keeps track of how many words and images it has filtered so you can understand how actively it is working.

### 10. Privacy-first design

PG Patrol is built so the core filtering happens on your device. It is designed for people who want safer browsing without sending their everyday page content to outside servers.

## What Makes PG Patrol Different

Many browser filters focus on only one problem. PG Patrol is broader and more practical for normal browsing.

- It handles both text and images
- It works while content is still arriving on the page
- It is meant for social feeds, search pages, comments, article pages, and media-heavy sites
- It gives users control with settings, whitelists, and custom word lists
- It is designed to be useful for both families and individual users

## If You Are Searching For...

PG Patrol is relevant if you are searching for phrases like:

- Chrome extension to block profanity
- Chrome extension to hide NSFW images
- family-friendly Chrome extension
- safe browsing extension for kids
- profanity blocker for Chrome
- NSFW blocker Chrome
- browser extension for safer web browsing
- Chrome extension to filter bad words
- Chrome extension to hide explicit images
- parental-style web filter for Chrome
- clean browsing extension
- real-time content filter for Chrome

## How PG Patrol Protects Kids During Everyday Browsing

Here is the non-technical version of what happens:

1. You open a web page.
2. PG Patrol starts watching the page.
3. Text can be cleaned up as it appears.
4. Images can be checked as they load.
5. Safe content stays visible.
6. Unsafe content gets hidden, softened, or replaced.
7. If more content appears later while you scroll, PG Patrol keeps working.

That real-time behavior is especially important on modern websites where the page keeps changing after the first load. In practice, this means protection can continue while a child is still scrolling, exploring, or clicking through a page.

## Privacy and Trust

PG Patrol is designed with a privacy-first approach.

- Core text filtering happens locally
- Core image filtering happens locally
- Settings are stored in Chrome storage
- No analytics or tracking are built into the core product

There is one optional exception:

- If you choose to use the optional Perspective API integration, text snippets may be sent to Google's Perspective API
- This is optional and requires your own API key
- It is not required for normal use

For the full privacy details, see [PRIVACY.md](./PRIVACY.md).

## Chrome Permissions Explained in Plain English

PG Patrol asks for a small set of permissions so it can do its job:

- `storage`: saves your settings and preferences
- `activeTab`: helps the extension work with the current tab
- `alarms`: supports background extension tasks
- `offscreen`: allows local background model work for content checks
- `host_permissions` on all URLs: lets PG Patrol filter pages you open

In plain terms, these permissions are what let the extension actually protect the pages you browse.

## How to Install PG Patrol in Chrome

If you want to use PG Patrol in Chrome from this package, follow these steps.

### Step 1: Download or clone this project

Get the project onto your computer.

### Step 2: Install dependencies

Open the project folder in Terminal and run:

```bash
npm install
```

### Step 3: Build the Chrome extension

Run:

```bash
npm run build
```

This creates the production-ready extension in the `dist` folder.

### Step 4: Open Chrome extensions

In Chrome, go to:

```text
chrome://extensions
```

### Step 5: Turn on Developer mode

Use the Developer mode toggle in the top-right corner of the extensions page.

### Step 6: Load the extension

Click **Load unpacked** and select the `dist` folder inside this project.

### Step 7: Pin PG Patrol

After installation, pin the extension to your Chrome toolbar so it is easy to open and manage.

## How to Use PG Patrol in Chrome

Once installed, using PG Patrol is simple.

### Open the popup

Click the PG Patrol icon in Chrome to open the extension popup.

### Turn filtering on or off

You can enable or disable the extension with a single main toggle.

### Choose what to filter

You can decide whether to use:

- Text filtering
- Image filtering
- Positive browsing mode

For most parents, the strongest everyday setup is to keep all three on.

### Adjust sensitivity

If you want lighter filtering, choose Mild.  
If you want a more balanced default experience, use Moderate.  
If you want the strongest filtering, choose Strict.

### Add your own custom words

You can create your own blocked words list and your own safe words list.

### Whitelist websites

If you trust a website or do not want PG Patrol to alter it, add it to the whitelist.

### Reveal content when needed

If you want to temporarily review what was hidden or softened, use the reveal controls from the extension.

## Best Use Cases for PG Patrol

PG Patrol is especially strong for:

- Safer browsing for kids
- Family laptop browsing
- Classroom browsing
- Reducing surprise explicit imagery
- Reducing accidental exposure to 18+ content
- Reducing accidental exposure to distress-heavy headlines or discussions
- Cleaning up comments sections
- Making social media feeds feel less harsh
- Softening toxic or distress-heavy online content
- Creating a more comfortable browsing experience at work or at home

## What Happens to NSFW Images

When PG Patrol identifies an unsafe image:

- The original image is hidden
- The layout of the page is preserved
- A PG Patrol banner is shown in its place

This is useful because it helps prevent explicit media from flashing on screen while still keeping the page readable.

## What Happens to Safe Images

When an image is considered safe:

- The image remains visible
- The page layout stays natural
- Browsing continues normally

## What Happens to Filtered Text

When PG Patrol detects offensive or unwanted wording:

- The text is cleaned up
- Reading remains easier and more comfortable
- The page usually still makes sense in context

## Optional Perspective API Support

PG Patrol includes optional support for Perspective API if you want extra text analysis.

Important points:

- It is optional
- It is off by default
- You must add your own API key
- Normal extension use does not require it

## Frequently Asked Questions

### Is PG Patrol a Chrome parental control extension?

It can be useful in many of the same situations, especially for families and kids, but it is best described as a family-friendly content filter for Chrome rather than a full parental control suite.

### Does PG Patrol work in real time?

Yes. PG Patrol is built for real-time browsing, including pages that load more content as you scroll.

### Does PG Patrol block NSFW images?

Yes. That is one of its main features.

### Does PG Patrol filter swear words?

Yes. It can replace or soften profanity and offensive wording.

### Is PG Patrol good for kids?

Yes. PG Patrol is specifically positioned around helping protect kids from accidental exposure to explicit, 18+, or distress-heavy content during normal browsing. Like any filter, it should be treated as a strong safety layer rather than a perfect guarantee.

### Does PG Patrol send my browsing data to a server?

Core filtering is designed to happen locally. Optional Perspective API use is separate and only happens if you choose to enable it with your own key.

### Can I install PG Patrol in Chrome manually?

Yes. The easiest way from this repository is to build the project and load the `dist` folder as an unpacked extension in `chrome://extensions`.

## Important Note

No content filter is perfect. PG Patrol is designed to reduce unwanted exposure and improve the browsing experience, but some false positives or false negatives can still happen. The right sensitivity level and custom settings can make a big difference.

## Project Summary

PG Patrol is a Chrome extension for:

- blocking profanity
- hiding NSFW images
- softening negative content
- supporting safer browsing in real time
- helping protect kids from accidental exposure to 18+ and distress-heavy content
- giving families and individual users more control over what they see online

If you want a Chrome extension that helps protect kids from accidental exposure to adult imagery, explicit thumbnails, profanity, and distress-heavy content, PG Patrol is built for that purpose.
