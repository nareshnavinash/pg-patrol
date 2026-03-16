/**
 * @jest-environment jsdom
 */

import {
  startObserver,
  stopObserver,
  pauseObserver,
  resumeObserver,
} from '../../src/content/observer';

describe('observer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    stopObserver();
  });

  afterEach(() => {
    stopObserver();
  });

  it('detects new text nodes added to the DOM', (done) => {
    startObserver((textNodes) => {
      expect(textNodes.length).toBeGreaterThan(0);
      const hasNewContent = textNodes.some((n) => n.textContent?.includes('Dynamic content'));
      expect(hasNewContent).toBe(true);
      done();
    });

    // Simulate dynamic content addition
    setTimeout(() => {
      const p = document.createElement('p');
      p.textContent = 'Dynamic content added';
      document.getElementById('root')!.appendChild(p);
    }, 10);
  }, 5000);

  it('detects new images added to the DOM', (done) => {
    startObserver(
      () => {
        /* text callback */
      },
      (images) => {
        expect(images.length).toBeGreaterThan(0);
        done();
      },
    );

    setTimeout(() => {
      const img = document.createElement('img');
      img.src = 'https://example.com/image.jpg';
      document.getElementById('root')!.appendChild(img);
    }, 10);
  }, 5000);

  it('detects new video elements with poster attributes', (done) => {
    startObserver(
      () => {
        /* text callback */
      },
      undefined,
      (videos) => {
        expect(videos.length).toBeGreaterThan(0);
        expect(videos[0]).toBeInstanceOf(HTMLVideoElement);
        expect(videos[0].poster).toContain('poster.jpg');
        done();
      },
    );

    setTimeout(() => {
      const video = document.createElement('video');
      video.poster = 'https://example.com/poster.jpg';
      document.getElementById('root')!.appendChild(video);
    }, 10);
  }, 5000);

  it('detects video elements inside added container elements', (done) => {
    startObserver(
      () => {},
      undefined,
      (videos) => {
        expect(videos.length).toBe(2);
        done();
      },
    );

    setTimeout(() => {
      const div = document.createElement('div');
      div.innerHTML = `
        <video poster="https://example.com/thumb1.jpg"></video>
        <video poster="https://example.com/thumb2.jpg"></video>
        <video></video>
      `;
      document.getElementById('root')!.appendChild(div);
    }, 10);
  }, 5000);

  it('does not report videos without poster to video callback', (done) => {
    const videoCallback = jest.fn();

    startObserver(() => {}, undefined, videoCallback);

    setTimeout(() => {
      const video = document.createElement('video');
      // No poster attribute
      document.getElementById('root')!.appendChild(video);
    }, 10);

    setTimeout(() => {
      expect(videoCallback).not.toHaveBeenCalled();
      done();
    }, 300);
  }, 5000);

  it('does not trigger callback when paused', (done) => {
    const callback = jest.fn();

    startObserver(callback);
    pauseObserver();

    setTimeout(() => {
      const p = document.createElement('p');
      p.textContent = 'Should not trigger';
      document.getElementById('root')!.appendChild(p);
    }, 10);

    setTimeout(() => {
      expect(callback).not.toHaveBeenCalled();
      resumeObserver();
      done();
    }, 300);
  }, 5000);

  it('stops observing after stopObserver is called', (done) => {
    const callback = jest.fn();

    startObserver(callback);
    stopObserver();

    setTimeout(() => {
      const p = document.createElement('p');
      p.textContent = 'Should not be observed';
      document.getElementById('root')!.appendChild(p);
    }, 10);

    setTimeout(() => {
      expect(callback).not.toHaveBeenCalled();
      done();
    }, 300);
  }, 5000);

  it('collects images and videos simultaneously', (done) => {
    let gotImages = false;
    let gotVideos = false;

    const checkDone = () => {
      if (gotImages && gotVideos) done();
    };

    startObserver(
      () => {},
      (images) => {
        expect(images.length).toBeGreaterThan(0);
        gotImages = true;
        checkDone();
      },
      (videos) => {
        expect(videos.length).toBeGreaterThan(0);
        gotVideos = true;
        checkDone();
      },
    );

    setTimeout(() => {
      const div = document.createElement('div');
      div.innerHTML = `
        <img src="https://example.com/photo.jpg" />
        <video poster="https://example.com/poster.jpg"></video>
      `;
      document.getElementById('root')!.appendChild(div);
    }, 10);
  }, 5000);

  it('triggers onImageAttrChange when an existing image src changes', (done) => {
    const img = document.createElement('img');
    img.src = 'https://example.com/old.jpg';
    document.getElementById('root')!.appendChild(img);

    startObserver(
      () => {},
      undefined,
      undefined,
      (changedImg) => {
        expect(changedImg).toBe(img);
        expect(changedImg.src).toContain('new.jpg');
        done();
      },
    );

    setTimeout(() => {
      img.src = 'https://example.com/new.jpg';
    }, 10);
  }, 5000);

  it('detects characterData mutations on existing text nodes', (done) => {
    const textNode = document.createTextNode('Original text');
    document.getElementById('root')!.appendChild(textNode);

    startObserver((textNodes) => {
      const hasUpdated = textNodes.some((n) => n.textContent?.includes('Updated text'));
      if (hasUpdated) {
        expect(hasUpdated).toBe(true);
        done();
      }
    });

    setTimeout(() => {
      textNode.textContent = 'Updated text here';
    }, 10);
  }, 5000);

  it('filters out empty text nodes', (done) => {
    const textCallback = jest.fn();

    startObserver(textCallback);

    setTimeout(() => {
      // Add a text node with only whitespace
      const emptyText = document.createTextNode('   ');
      document.getElementById('root')!.appendChild(emptyText);

      // Also add a non-empty text node so we can verify filtering
      const realText = document.createElement('p');
      realText.textContent = 'Real content';
      document.getElementById('root')!.appendChild(realText);
    }, 10);

    setTimeout(() => {
      if (textCallback.mock.calls.length > 0) {
        const allTextNodes = textCallback.mock.calls.flatMap((call: [Text[]]) => call[0]);
        // None of the collected text nodes should be whitespace-only
        for (const node of allTextNodes) {
          expect(node.textContent!.trim().length).toBeGreaterThan(0);
        }
      }
      done();
    }, 300);
  }, 5000);

  it('clears and resets debounce timer on rapid mutations', (done) => {
    const textCallback = jest.fn();

    startObserver(textCallback);

    // Fire multiple mutations rapidly — debounce should coalesce them
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        const p = document.createElement('p');
        p.textContent = `Rapid mutation ${i}`;
        document.getElementById('root')!.appendChild(p);
      }
    }, 10);

    // After debounce settles, the callback should have been called
    // with all the text nodes coalesced (not 5 separate calls)
    setTimeout(() => {
      // Should have been called at least once with aggregated nodes
      expect(textCallback).toHaveBeenCalled();
      // All 5 rapid mutations should be batched — the callback call count
      // should be less than the number of mutations
      expect(textCallback.mock.calls.length).toBeLessThanOrEqual(2);
      done();
    }, 400);
  }, 5000);

  it('trims pending mutations when exceeding MAX_PENDING_MUTATIONS', (done) => {
    const textCallback = jest.fn();

    startObserver(textCallback);

    // Trigger a very large number of mutations to exceed the 1000 limit
    setTimeout(() => {
      for (let i = 0; i < 1100; i++) {
        const span = document.createElement('span');
        span.textContent = `Overflow node ${i}`;
        document.getElementById('root')!.appendChild(span);
      }
    }, 10);

    // After the debounce, callback should still fire without crashing
    setTimeout(() => {
      expect(textCallback).toHaveBeenCalled();
      done();
    }, 400);
  }, 10000);

  it('disconnects existing observer when startObserver is called again', (done) => {
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    startObserver(firstCallback);

    // Start a new observer — old one should be disconnected
    startObserver(secondCallback);

    setTimeout(() => {
      const p = document.createElement('p');
      p.textContent = 'After restart';
      document.getElementById('root')!.appendChild(p);
    }, 10);

    setTimeout(() => {
      // Only the second callback should have been called
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalled();
      done();
    }, 300);
  }, 5000);
});
