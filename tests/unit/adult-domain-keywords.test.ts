import { isAdultDomain } from '../../src/shared/adult-domain-keywords';

describe('isAdultDomain', () => {
  describe('exact domain matches', () => {
    const adultDomains = [
      'pornhub.com',
      'www.pornhub.com',
      'de.pornhub.com',
      'xvideos.com',
      'xhamster.com',
      'chaturbate.com',
      'redtube.com',
      'youporn.com',
      'onlyfans.com',
      'stripchat.com',
      'xnxx.com',
      'nhentai.net',
      'sex.com',
      'smut.com',
      'porn.com',
      'nude.com',
      'xxx.com',
      'brazzers.com',
      'literotica.com',
      'fetlife.com',
    ];

    it.each(adultDomains)('flags %s as adult', (domain) => {
      expect(isAdultDomain(domain)).toBe(true);
    });
  });

  describe('.xxx TLD', () => {
    it('flags rule34.xxx', () => {
      expect(isAdultDomain('rule34.xxx')).toBe(true);
    });

    it('flags anything.xxx', () => {
      expect(isAdultDomain('anything.xxx')).toBe(true);
    });

    it('flags www.example.xxx', () => {
      expect(isAdultDomain('www.example.xxx')).toBe(true);
    });
  });

  describe('subdomain handling', () => {
    it('flags www.pornhub.com', () => {
      expect(isAdultDomain('www.pornhub.com')).toBe(true);
    });

    it('flags de.pornhub.com (country subdomain)', () => {
      expect(isAdultDomain('de.pornhub.com')).toBe(true);
    });

    it('flags cdn.onlyfans.com', () => {
      expect(isAdultDomain('cdn.onlyfans.com')).toBe(true);
    });
  });

  describe('safe domains — no false positives', () => {
    const safeDomains = [
      'google.com',
      'github.com',
      'reddit.com',
      'youtube.com',
      'wikipedia.org',
      'stackoverflow.com',
      'amazon.com',
      'bbc.co.uk',
      'nytimes.com',
      'essex.gov.uk',
      'sussex.ac.uk',
      'middlesex.edu',
      'cockburn.wa.gov.au',
      'sextant.com',
      'sexsmith.ca',
      'cumberland.gov.uk',
      'peniston.org',
      'therapist.com',
      'exchange.com',
      'expert.com',
    ];

    it.each(safeDomains)('does NOT flag %s', (domain) => {
      expect(isAdultDomain(domain)).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('flags PornHub.com', () => {
      expect(isAdultDomain('PornHub.com')).toBe(true);
    });

    it('flags SMUT.COM', () => {
      expect(isAdultDomain('SMUT.COM')).toBe(true);
    });

    it('flags OnlyFans.com', () => {
      expect(isAdultDomain('OnlyFans.com')).toBe(true);
    });
  });

  describe('domains NOT in the list', () => {
    it('does not flag unlisted adult-sounding domains', () => {
      // Only exact matches — no keyword matching
      expect(isAdultDomain('mypornsite.example.com')).toBe(false);
    });

    it('does not flag random domains with adult substrings', () => {
      expect(isAdultDomain('pornhubfake.com')).toBe(false);
    });
  });
});
