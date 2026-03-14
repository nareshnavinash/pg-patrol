/**
 * @jest-environment jsdom
 */

import { replaceProfanity } from '../../src/shared/profanity-engine';

describe('content-filtering integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('profane URL handling in DOM', () => {
    it('profane URLs become clickable <a> elements with [link] text', () => {
      document.body.innerHTML = '<p id="test">Visit https://example.com/shitpost for details</p>';
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;
      const result = replaceProfanity(textNode.textContent!);

      expect(result.profaneUrls.length).toBe(1);

      // Simulate the content script's DOM manipulation
      const fragment = document.createDocumentFragment();
      const parts = result.filtered.split('[link]');

      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          fragment.appendChild(document.createTextNode(parts[i]));
        }
        if (i < result.profaneUrls.length) {
          const a = document.createElement('a');
          a.href = result.profaneUrls[i].url;
          a.textContent = '[link]';
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          fragment.appendChild(a);
        }
      }
      p.replaceChild(fragment, textNode);

      const link = p.querySelector('a');
      expect(link).not.toBeNull();
      expect(link!.textContent).toBe('[link]');
      expect(link!.href).toBe('https://example.com/shitpost');
      expect(link!.target).toBe('_blank');
      expect(link!.rel).toBe('noopener noreferrer');
    });

    it('clean URLs remain as plain text', () => {
      document.body.innerHTML = '<p id="test">Visit https://example.com/blog for news</p>';
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;
      const result = replaceProfanity(textNode.textContent!);

      expect(result.profaneUrls.length).toBe(0);
      // No DOM manipulation needed — text stays as-is
      expect(p.querySelector('a')).toBeNull();
      expect(p.textContent).toContain('https://example.com/blog');
    });
  });

  describe('reveal and re-filter', () => {
    it('original text can be stored and restored', () => {
      const originalText = 'What the fuck is going on?';
      document.body.innerHTML = `<p id="test">${originalText}</p>`;
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;

      // Store original
      const originalTexts = new Map<Node, string>();
      originalTexts.set(textNode, textNode.textContent!);

      // Filter
      const result = replaceProfanity(textNode.textContent!);
      textNode.textContent = result.filtered;

      expect(textNode.textContent).not.toContain('fuck');

      // Reveal: restore original
      for (const [node, original] of originalTexts) {
        (node as Text).textContent = original;
      }

      expect(textNode.textContent).toBe(originalText);
    });

    it('re-enabling filtering after reveal re-filters everything', () => {
      const originalText = 'This is total bullshit';
      document.body.innerHTML = `<p id="test">${originalText}</p>`;
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;

      // First filter
      const result1 = replaceProfanity(textNode.textContent!);
      const originalTexts = new Map<Node, string>();
      originalTexts.set(textNode, textNode.textContent!);
      textNode.textContent = result1.filtered;
      expect(textNode.textContent).not.toContain('bullshit');

      // Reveal
      for (const [node, original] of originalTexts) {
        (node as Text).textContent = original;
      }
      expect(textNode.textContent).toBe(originalText);

      // Re-filter
      originalTexts.clear();
      originalTexts.set(textNode, textNode.textContent!);
      const result2 = replaceProfanity(textNode.textContent!);
      textNode.textContent = result2.filtered;
      expect(textNode.textContent).not.toContain('bullshit');
    });

    it('reveal undoes URL link replacements', () => {
      const originalText = 'See https://example.com/shitpost here';
      document.body.innerHTML = `<p id="test">${originalText}</p>`;
      const p = document.getElementById('test')!;
      const textNode = p.firstChild as Text;

      // Store original
      const storedOriginal = textNode.textContent!;

      // Filter with URL masking
      const result = replaceProfanity(textNode.textContent!);
      expect(result.profaneUrls.length).toBe(1);

      // Build fragment like content script does
      const fragment = document.createDocumentFragment();
      const parts = result.filtered.split('[link]');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) fragment.appendChild(document.createTextNode(parts[i]));
        if (i < result.profaneUrls.length) {
          const a = document.createElement('a');
          a.href = result.profaneUrls[i].url;
          a.textContent = '[link]';
          fragment.appendChild(a);
        }
      }
      p.replaceChild(fragment, textNode);

      expect(p.querySelector('a')).not.toBeNull();

      // Reveal: restore to plain text
      while (p.firstChild) p.removeChild(p.firstChild);
      p.appendChild(document.createTextNode(storedOriginal));

      expect(p.querySelector('a')).toBeNull();
      expect(p.textContent).toBe(originalText);
    });
  });

  describe('dynamically inserted content (SPA behavior)', () => {
    it('filters profanity in dynamically inserted text nodes', () => {
      document.body.innerHTML = '<div id="app"></div>';
      const app = document.getElementById('app')!;

      // Simulate SPA inserting new content dynamically
      const newElement = document.createElement('p');
      newElement.textContent = 'This is some bullshit content loaded via AJAX';
      app.appendChild(newElement);

      // Content script would observe this via MutationObserver and filter it
      const textNode = newElement.firstChild as Text;
      const result = replaceProfanity(textNode.textContent!);

      if (result.hasProfanity) {
        textNode.textContent = result.filtered;
      }

      expect(result.hasProfanity).toBe(true);
      expect(newElement.textContent).not.toContain('bullshit');
      expect(newElement.textContent).toBeTruthy();
    });

    it('filters profanity in deeply nested dynamically inserted elements', () => {
      document.body.innerHTML = '<div id="app"></div>';
      const app = document.getElementById('app')!;

      // Simulate SPA inserting a complex subtree
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <article>
          <h2>Article Title</h2>
          <p>This article is about some shit that happened</p>
          <p>It was a damn good day otherwise</p>
        </article>
      `;
      app.appendChild(wrapper);

      // Walk all text nodes (simulating what the content script does)
      const walker = document.createTreeWalker(
        wrapper,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let node: Text | null;
      const filtered: string[] = [];
      while ((node = walker.nextNode() as Text | null)) {
        const text = node.textContent?.trim();
        if (!text) continue;

        const result = replaceProfanity(text);
        if (result.hasProfanity) {
          node.textContent = result.filtered;
          filtered.push(result.filtered);
        }
      }

      // "shit" should be replaced
      const articleText = wrapper.textContent!;
      expect(articleText).not.toContain('shit');
      expect(filtered.length).toBeGreaterThan(0);
    });
  });
});
