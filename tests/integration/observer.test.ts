/**
 * @jest-environment jsdom
 */

import { startObserver, stopObserver, pauseObserver, resumeObserver } from '../../src/content/observer';

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
      const hasNewContent = textNodes.some(
        (n) => n.textContent?.includes('Dynamic content'),
      );
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
      () => { /* text callback */ },
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
      () => { /* text callback */ },
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

    startObserver(
      () => {},
      undefined,
      videoCallback,
    );

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
});
