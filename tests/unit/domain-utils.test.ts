import { getRegistrableDomain } from '../../src/shared/domain-utils';

describe('getRegistrableDomain', () => {
  describe('standard domains', () => {
    it('returns a bare domain as-is', () => {
      expect(getRegistrableDomain('example.com')).toBe('example.com');
    });

    it('strips www subdomain', () => {
      expect(getRegistrableDomain('www.example.com')).toBe('example.com');
    });

    it('strips deep subdomains', () => {
      expect(getRegistrableDomain('a.b.c.example.com')).toBe('example.com');
    });
  });

  describe('country-code TLDs (ccTLDs)', () => {
    it('handles .co.uk', () => {
      expect(getRegistrableDomain('www.bbc.co.uk')).toBe('bbc.co.uk');
    });

    it('handles .co.in', () => {
      expect(getRegistrableDomain('www.amazon.co.in')).toBe('amazon.co.in');
    });

    it('handles .co.jp', () => {
      expect(getRegistrableDomain('www.amazon.co.jp')).toBe('amazon.co.jp');
    });

    it('handles .com.au', () => {
      expect(getRegistrableDomain('www.google.com.au')).toBe('google.com.au');
    });

    it('handles .com.br', () => {
      expect(getRegistrableDomain('www.google.com.br')).toBe('google.com.br');
    });

    it('handles .org.uk', () => {
      expect(getRegistrableDomain('www.example.org.uk')).toBe('example.org.uk');
    });
  });

  describe('edge cases', () => {
    it('returns single-label hostname as-is', () => {
      expect(getRegistrableDomain('localhost')).toBe('localhost');
    });

    it('returns two-part domain as-is', () => {
      expect(getRegistrableDomain('github.com')).toBe('github.com');
    });

    it('handles .net TLD', () => {
      expect(getRegistrableDomain('www.nhentai.net')).toBe('nhentai.net');
    });

    it('handles .org TLD', () => {
      expect(getRegistrableDomain('en.wikipedia.org')).toBe('wikipedia.org');
    });

    it('handles .so TLD', () => {
      expect(getRegistrableDomain('www.notion.so')).toBe('notion.so');
    });
  });
});
