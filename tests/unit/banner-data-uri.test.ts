/**
 * @jest-environment jsdom
 */

import { createBannerDataUri } from '../../src/content/banner-data-uri';

describe('createBannerDataUri', () => {
  it('returns a valid data:image/svg+xml URI', () => {
    const uri = createBannerDataUri();
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('contains "PG Patrol" text', () => {
    const uri = decodeURIComponent(createBannerDataUri());
    expect(uri).toContain('PG Patrol');
  });

  it('contains "Restricted image hidden" text', () => {
    const uri = decodeURIComponent(createBannerDataUri());
    expect(uri).toContain('Restricted image hidden');
  });

  it('contains SVG content with viewBox', () => {
    const uri = decodeURIComponent(createBannerDataUri());
    expect(uri).toContain('<svg');
    expect(uri).toContain('viewBox');
    expect(uri).toContain('</svg>');
  });

  it('contains the explanation text', () => {
    const uri = decodeURIComponent(createBannerDataUri());
    expect(uri).toContain('Sensitive media was removed from view.');
  });
});
