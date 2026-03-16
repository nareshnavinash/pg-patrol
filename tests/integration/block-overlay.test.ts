/**
 * @jest-environment jsdom
 */

import { applyOverlay, removeOverlay, removeAllOverlays } from '../../src/content/block-overlay';

describe('block-overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('applyOverlay wraps content in blur container and adds crisp overlay', () => {
    document.body.innerHTML = '<p id="test">Some distressing content here</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);

    expect(el.getAttribute('data-pg-patrol-overlay')).toBe('true');
    expect(el.style.overflow).toBe('hidden');

    // Original content should be inside the blur wrapper
    const blurWrap = el.querySelector('[data-pg-patrol-blur-wrap]') as HTMLElement;
    expect(blurWrap).not.toBeNull();
    expect(blurWrap.style.filter).toBe('blur(5px)');
    expect(blurWrap.textContent).toContain('Some distressing content here');

    // Overlay should be a sibling of blur wrapper (not inside it), so it stays crisp
    const overlay = el.querySelector('[data-pg-patrol-overlay-inner]') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.parentElement).toBe(el);
    expect(overlay.textContent).toContain('Hidden by PG Patrol');
    expect(overlay.textContent).toContain('Click to reveal');

    // Overlay should NOT be inside the blur wrapper
    expect(blurWrap.contains(overlay)).toBe(false);
  });

  it('uses row layout for short elements (height < 80px)', () => {
    document.body.innerHTML = '<p id="test">Some distressing content here</p>';
    const el = document.getElementById('test') as HTMLElement;

    // jsdom elements have 0 height, so useRow = true
    applyOverlay(el);

    const overlay = el.querySelector('[data-pg-patrol-overlay-inner]') as HTMLElement;
    expect(overlay.style.flexDirection).toBe('row');
    expect(overlay.style.whiteSpace).toBe('nowrap');
  });

  it('does not double-apply overlay', () => {
    document.body.innerHTML = '<p id="test">Content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);
    applyOverlay(el);

    const inners = el.querySelectorAll('[data-pg-patrol-overlay-inner]');
    expect(inners.length).toBe(1);
  });

  it('removeOverlay unwraps content and restores original element', () => {
    document.body.innerHTML = '<p id="test"><span>Child A</span> text</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);
    expect(el.querySelector('[data-pg-patrol-blur-wrap]')).not.toBeNull();

    removeOverlay(el);

    expect(el.getAttribute('data-pg-patrol-overlay')).toBeNull();
    expect(el.style.overflow).toBe('');
    expect(el.querySelector('[data-pg-patrol-overlay-inner]')).toBeNull();
    expect(el.querySelector('[data-pg-patrol-blur-wrap]')).toBeNull();

    // Original children should be back directly under the element
    expect(el.textContent).toContain('Child A');
    expect(el.textContent).toContain('text');
  });

  it('removeAllOverlays clears all overlays on page', () => {
    document.body.innerHTML = `
      <p id="a">Content A is long enough</p>
      <p id="b">Content B is long enough</p>
      <p id="c">Content C is long enough</p>
    `;
    const a = document.getElementById('a') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;

    applyOverlay(a);
    applyOverlay(b);

    expect(document.querySelectorAll('[data-pg-patrol-overlay]').length).toBe(2);

    removeAllOverlays();

    expect(document.querySelectorAll('[data-pg-patrol-overlay]').length).toBe(0);
    expect(document.querySelectorAll('[data-pg-patrol-blur-wrap]').length).toBe(0);
    expect(a.textContent).toContain('Content A');
    expect(b.textContent).toContain('Content B');
  });

  it('click on overlay removes it after animation (reveal)', (done) => {
    document.body.innerHTML = '<p id="test">Distressing content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);

    const inner = el.querySelector('[data-pg-patrol-overlay-inner]') as HTMLElement;
    expect(inner).not.toBeNull();

    // Simulate click — animateReveal uses setTimeout(300ms)
    inner.click();

    // Check revealed attribute is set immediately
    expect(el.getAttribute('data-pg-patrol-revealed')).toBe('true');

    // After 350ms, the overlay should be fully removed
    setTimeout(() => {
      expect(el.getAttribute('data-pg-patrol-overlay')).toBeNull();
      expect(el.querySelector('[data-pg-patrol-overlay-inner]')).toBeNull();
      expect(el.querySelector('[data-pg-patrol-blur-wrap]')).toBeNull();
      expect(el.textContent).toContain('Distressing content');
      done();
    }, 350);
  });

  it('sets position relative when element is static', () => {
    document.body.innerHTML = '<p id="test" style="position: static">Content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);
    expect(el.style.position).toBe('relative');

    removeOverlay(el);
    expect(el.style.position).toBe('');
  });

  it('preserves non-static positioning', () => {
    document.body.innerHTML = '<p id="test" style="position: absolute">Content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);
    // Should not override absolute positioning
    expect(el.style.position).toBe('absolute');
  });

  it('skips overlay on child when ancestor already has one (nested blocks)', () => {
    document.body.innerHTML =
      '<article id="parent"><p id="child">Nested negative content here</p></article>';
    const parent = document.getElementById('parent') as HTMLElement;
    const child = document.getElementById('child') as HTMLElement;

    applyOverlay(parent);
    applyOverlay(child);

    // Only parent should have overlay; child should be skipped
    expect(parent.getAttribute('data-pg-patrol-overlay')).toBe('true');
    expect(child.getAttribute('data-pg-patrol-overlay')).toBeNull();
    expect(document.querySelectorAll('[data-pg-patrol-overlay-inner]').length).toBe(1);
  });

  it('skips overlay on parent when descendant already has one', () => {
    document.body.innerHTML =
      '<article id="parent"><p id="child">Nested negative content here</p></article>';
    const parent = document.getElementById('parent') as HTMLElement;
    const child = document.getElementById('child') as HTMLElement;

    // Apply to child first
    applyOverlay(child);
    applyOverlay(parent);

    // Only child should have overlay; parent should be skipped
    expect(child.getAttribute('data-pg-patrol-overlay')).toBe('true');
    expect(parent.getAttribute('data-pg-patrol-overlay')).toBeNull();
    expect(document.querySelectorAll('[data-pg-patrol-overlay-inner]').length).toBe(1);
  });

  it('sets minHeight on overlaid element for overlay visibility', () => {
    document.body.innerHTML = '<p id="test">Short content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);
    expect(el.style.minHeight).toBe('44px');

    removeOverlay(el);
    expect(el.style.minHeight).toBe('');
  });

  it('skips child overlay when ancestor has been revealed (re-scan protection)', () => {
    document.body.innerHTML =
      '<article id="parent"><p id="child">Negative content here</p></article>';
    const parent = document.getElementById('parent') as HTMLElement;
    const child = document.getElementById('child') as HTMLElement;

    // Simulate: parent was overlaid, then revealed by user click
    parent.setAttribute('data-pg-patrol-revealed', 'true');

    // Observer re-scan tries to overlay the child
    applyOverlay(child);

    // Child should be skipped because ancestor is revealed
    expect(child.getAttribute('data-pg-patrol-overlay')).toBeNull();
  });

  it('applies overlay with dark theme detection on dark backgrounds', () => {
    document.body.innerHTML = '<p id="test">Distressing content</p>';
    const el = document.getElementById('test') as HTMLElement;

    // Set a dark background on body
    document.body.style.backgroundColor = 'rgb(30, 30, 30)';

    applyOverlay(el);

    const overlay = el.querySelector('[data-pg-patrol-overlay-inner]') as HTMLElement;
    expect(overlay).not.toBeNull();
    // Dark page should produce lighter overlay colors
    expect(overlay.style.backgroundColor).toBeTruthy();
  });

  it('removeAllOverlays clears revealed attributes', () => {
    document.body.innerHTML = '<p id="test">Content</p>';
    const el = document.getElementById('test') as HTMLElement;

    applyOverlay(el);

    // Simulate reveal
    el.setAttribute('data-pg-patrol-revealed', 'true');

    removeAllOverlays();

    expect(el.getAttribute('data-pg-patrol-revealed')).toBeNull();
  });

  it('click sets revealed attr on descendant blocks too', (done) => {
    document.body.innerHTML =
      '<article id="parent"><p id="child">Negative content here</p></article>';
    const parent = document.getElementById('parent') as HTMLElement;

    applyOverlay(parent);

    const inner = parent.querySelector('[data-pg-patrol-overlay-inner]') as HTMLElement;
    inner.click();

    expect(parent.getAttribute('data-pg-patrol-revealed')).toBe('true');

    // After cleanup, the child p should also have revealed attr
    setTimeout(() => {
      const child = document.getElementById('child') as HTMLElement;
      expect(child.getAttribute('data-pg-patrol-revealed')).toBe('true');
      done();
    }, 350);
  });
});
