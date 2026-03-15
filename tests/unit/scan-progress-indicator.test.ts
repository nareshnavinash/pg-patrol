import { showScanProgress, hideScanProgress } from '../../src/content/scan-progress-indicator';

const PILL_ID = 'pg-patrol-scan-progress';

describe('scan-progress-indicator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    const pill = document.getElementById(PILL_ID);
    pill?.remove();
    jest.useRealTimers();
  });

  describe('showScanProgress', () => {
    it('does not create pill when total is 0', () => {
      showScanProgress(0, 0);
      expect(document.getElementById(PILL_ID)).toBeNull();
    });

    it('creates a fixed pill at top-center', () => {
      showScanProgress(3, 12);
      const pill = document.getElementById(PILL_ID);
      expect(pill).not.toBeNull();
      expect(pill!.style.position).toBe('fixed');
      expect(pill!.style.top).toBe('12px');
      expect(pill!.style.left).toBe('50%');
      expect(pill!.style.borderRadius).toBe('9999px');
      expect(pill!.style.zIndex).toBe('2147483647');
    });

    it('displays scanning text with progress counts', () => {
      showScanProgress(3, 12);
      const pill = document.getElementById(PILL_ID);
      expect(pill!.textContent).toContain('3/12 images');
    });

    it('updates text on subsequent calls', () => {
      showScanProgress(1, 10);
      showScanProgress(5, 10);
      const pill = document.getElementById(PILL_ID);
      expect(pill!.textContent).toContain('5/10 images');
    });

    it('does not duplicate the pill', () => {
      showScanProgress(1, 5);
      showScanProgress(2, 5);
      const pills = document.querySelectorAll(`#${PILL_ID}`);
      expect(pills.length).toBe(1);
    });

    it('uses frosted indigo glass background', () => {
      showScanProgress(1, 5);
      const pill = document.getElementById(PILL_ID)!;
      // rgba background with alpha for glassmorphism
      expect(pill.style.background).toContain('67, 56, 202');
      expect(pill.style.background).toContain('0.7');
    });

    it('applies backdrop-filter blur for glassmorphism', () => {
      showScanProgress(1, 5);
      const pill = document.getElementById(PILL_ID)!;
      expect(pill.style.backdropFilter).toBe('blur(12px)');
    });
  });

  describe('hideScanProgress', () => {
    it('fades out and removes the pill after animation', () => {
      showScanProgress(5, 5);
      const pill = document.getElementById(PILL_ID)!;

      hideScanProgress();
      expect(pill.style.opacity).toBe('0');

      // After transition delay, pill is removed from DOM
      jest.advanceTimersByTime(300);
      expect(document.getElementById(PILL_ID)).toBeNull();
    });

    it('no-ops when no pill exists', () => {
      expect(() => hideScanProgress()).not.toThrow();
    });

    it('re-shows pill on new showScanProgress after hide', () => {
      showScanProgress(3, 5);
      hideScanProgress();
      jest.advanceTimersByTime(300);

      // Pill was removed, new call creates a fresh one
      showScanProgress(1, 8);
      const pill = document.getElementById(PILL_ID);
      expect(pill).not.toBeNull();
      expect(pill!.textContent).toContain('1/8 images');
    });
  });
});
