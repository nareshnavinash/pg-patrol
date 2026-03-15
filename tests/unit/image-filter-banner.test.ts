import { showImageFilterBanner, removeImageFilterBanner } from '../../src/content/image-filter-banner';

describe('showImageFilterBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    removeImageFilterBanner();
    jest.useRealTimers();
  });

  it('does not create a banner when count is 0', () => {
    showImageFilterBanner(0);
    expect(document.getElementById('pg-patrol-image-banner')).toBeNull();
  });

  it('does not create a banner when count is negative', () => {
    showImageFilterBanner(-1);
    expect(document.getElementById('pg-patrol-image-banner')).toBeNull();
  });

  it('creates a banner for 1 filtered image', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('1 image filtered');
  });

  it('uses plural for multiple images', () => {
    showImageFilterBanner(5);
    const banner = document.getElementById('pg-patrol-image-banner');
    expect(banner!.textContent).toContain('5 images filtered');
  });

  it('does not duplicate if called twice', () => {
    showImageFilterBanner(3);
    showImageFilterBanner(5);
    const banners = document.querySelectorAll('#pg-patrol-image-banner');
    expect(banners.length).toBe(1);
  });

  it('updates the count on subsequent calls', () => {
    showImageFilterBanner(1);
    showImageFilterBanner(3);
    const banner = document.getElementById('pg-patrol-image-banner');
    expect(banner!.textContent).toContain('3 images filtered');
  });

  it('auto-dismisses after timeout', () => {
    showImageFilterBanner(2);
    const banner = document.getElementById('pg-patrol-image-banner')!;

    // After auto-dismiss timeout, banner fades out but stays in DOM
    jest.advanceTimersByTime(6000);
    expect(banner.style.opacity).toBe('0');
  });

  it('re-shows after dismiss when new images are filtered', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner')!;

    // Let it auto-dismiss
    jest.advanceTimersByTime(6000);
    expect(banner.style.opacity).toBe('0');

    // New image hidden — banner should reappear with updated count
    showImageFilterBanner(3);
    expect(banner.style.opacity).toBe('1');
    expect(banner.textContent).toContain('3 images filtered');
  });

  it('dismisses on click', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner')!;

    banner.click();
    expect(banner.style.opacity).toBe('0');
  });

  it('is styled as fixed position bottom-right with frosted glass background', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner')!;
    expect(banner.style.position).toBe('fixed');
    expect(banner.style.bottom).toBe('16px');
    expect(banner.style.right).toBe('16px');
    // rgba background with alpha for glassmorphism
    expect(banner.style.background).toContain('67, 56, 202');
    expect(banner.style.background).toContain('0.65');
  });

  it('applies backdrop-filter blur for glassmorphism', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner')!;
    expect(banner.style.backdropFilter).toBe('blur(12px)');
  });

  it('uses white-alpha border for frosted edge shimmer', () => {
    showImageFilterBanner(1);
    const banner = document.getElementById('pg-patrol-image-banner')!;
    expect(banner.style.border).toContain('rgba(255');
  });
});

describe('removeImageFilterBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes existing banner from DOM', () => {
    showImageFilterBanner(3);
    expect(document.getElementById('pg-patrol-image-banner')).not.toBeNull();

    removeImageFilterBanner();
    expect(document.getElementById('pg-patrol-image-banner')).toBeNull();
  });

  it('no-ops when no banner exists', () => {
    expect(() => removeImageFilterBanner()).not.toThrow();
  });
});
