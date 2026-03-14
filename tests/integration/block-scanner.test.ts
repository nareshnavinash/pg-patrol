/**
 * @jest-environment jsdom
 */

import { getFilterableBlocks } from '../../src/content/block-scanner';

describe('block-scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds block elements (p, article, h1-h6)', () => {
    document.body.innerHTML = `
      <article>This is an article with enough text to pass the minimum length filter.</article>
      <p>This is a paragraph with enough text to pass the minimum length filter.</p>
      <h2>This is a heading with enough text to pass filter</h2>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(3);
  });

  it('finds li and blockquote elements', () => {
    document.body.innerHTML = `
      <ul>
        <li>This is a list item with enough text to pass the minimum length filter.</li>
      </ul>
      <blockquote>This is a blockquote with enough text to pass the minimum length filter.</blockquote>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(2);
  });

  it('skips elements inside SCRIPT tags', () => {
    document.body.innerHTML = `
      <p>Visible paragraph with enough text to pass the minimum length filter.</p>
      <script><p>Script paragraph with enough text to pass the minimum length.</p></script>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('Visible paragraph');
  });

  it('skips elements inside CODE tags', () => {
    document.body.innerHTML = `
      <p>Normal paragraph with enough text to pass the minimum length filter.</p>
      <code><p>Code paragraph with enough text to pass the minimum length.</p></code>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('Normal paragraph');
  });

  it('skips elements inside PRE tags', () => {
    document.body.innerHTML = `
      <p>Normal paragraph with enough text to pass the minimum length filter.</p>
      <pre><p>Pre paragraph with enough text to pass the minimum length.</p></pre>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
  });

  it('skips blocks with less than 20 characters', () => {
    document.body.innerHTML = `
      <p>Short text</p>
      <p>This paragraph has more than twenty characters of content.</p>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('twenty characters');
  });

  it('skips already-overlaid blocks', () => {
    document.body.innerHTML = `
      <p data-pg-patrol-overlay="true">This overlaid block should be skipped by the scanner.</p>
      <p>This normal block should be found by the scanner and returned.</p>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('normal block');
  });

  it('returns element reference and text content', () => {
    document.body.innerHTML = `
      <p id="my-block">This is a test paragraph with enough text content.</p>
    `;
    const blocks = getFilterableBlocks();
    expect(blocks.length).toBe(1);
    expect(blocks[0].element.id).toBe('my-block');
    expect(blocks[0].text).toContain('test paragraph');
  });

  it('can scan a subtree instead of full body', () => {
    document.body.innerHTML = `
      <div id="section-a"><p>Paragraph A has enough text to pass filter.</p></div>
      <div id="section-b"><p>Paragraph B has enough text to pass filter.</p></div>
    `;
    const subtree = document.getElementById('section-a')!;
    const blocks = getFilterableBlocks(subtree);
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toContain('Paragraph A');
  });
});
