/**
 * @jest-environment jsdom
 */

import { getFilterableTextNodes } from '../../src/content/dom-walker';

describe('dom-walker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds text nodes in simple HTML', () => {
    document.body.innerHTML = '<p>Hello world</p>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Hello world');
  });

  it('finds multiple text nodes', () => {
    document.body.innerHTML = '<p>First paragraph</p><p>Second paragraph</p>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(2);
  });

  it('skips script tags', () => {
    document.body.innerHTML = '<p>Visible text</p><script>var x = "fuck";</script>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Visible text');
  });

  it('skips style tags', () => {
    document.body.innerHTML = '<p>Visible text</p><style>.foo { color: red; }</style>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
  });

  it('skips noscript tags', () => {
    document.body.innerHTML = '<p>Visible</p><noscript>Noscript content</noscript>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
  });

  it('skips code tags', () => {
    document.body.innerHTML = '<p>Normal text</p><code>code content</code>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Normal text');
  });

  it('skips pre tags', () => {
    document.body.innerHTML = '<p>Normal</p><pre>preformatted content</pre>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
  });

  it('skips textarea elements', () => {
    document.body.innerHTML = '<p>Normal</p><textarea>textarea content</textarea>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
  });

  it('skips input elements', () => {
    document.body.innerHTML = '<p>Normal</p><input value="input content" />';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
  });

  it('skips empty text nodes', () => {
    document.body.innerHTML = '<p>  </p><p>Content</p>';
    const nodes = getFilterableTextNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Content');
  });

  it('walks nested elements', () => {
    document.body.innerHTML = `
      <div>
        <div>
          <span>Deeply nested text</span>
        </div>
      </div>
    `;
    const nodes = getFilterableTextNodes();
    const contentNodes = nodes.filter((n) => n.textContent!.trim() === 'Deeply nested text');
    expect(contentNodes.length).toBe(1);
  });

  it('can walk a subtree instead of full body', () => {
    document.body.innerHTML = '<div id="a"><p>Text A</p></div><div id="b"><p>Text B</p></div>';
    const subtree = document.getElementById('a')!;
    const nodes = getFilterableTextNodes(subtree);
    expect(nodes.length).toBe(1);
    expect(nodes[0].textContent).toBe('Text A');
  });
});
