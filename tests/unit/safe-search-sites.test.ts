import { isSafeSearchSite } from '../../src/shared/safe-search-sites';

describe('isSafeSearchSite', () => {
  describe('listed domains return true', () => {
    const safeDomains = [
      'google.com',
      'bing.com',
      'duckduckgo.com',
      'yahoo.com',
      'linkedin.com',
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'stackoverflow.com',
      'stackexchange.com',
      'notion.so',
      'figma.com',
      'canva.com',
      'slack.com',
      'trello.com',
      'asana.com',
      'airtable.com',
      'monday.com',
      'microsoft.com',
      'office.com',
      'live.com',
      'outlook.com',
      'apple.com',
      'icloud.com',
      'wikipedia.org',
      'khanacademy.org',
      'coursera.org',
      'edx.org',
      'amazon.com',
      'ebay.com',
      'flipkart.com',
      'etsy.com',
      'bbc.com',
      'reuters.com',
      'paypal.com',
      'stripe.com',
    ];

    it.each(safeDomains)('flags %s as safe', (domain) => {
      expect(isSafeSearchSite(domain)).toBe(true);
    });
  });

  describe('subdomains return true', () => {
    const subdomains = [
      'www.linkedin.com',
      'docs.google.com',
      'mail.google.com',
      'www.github.com',
      'gist.github.com',
      'www.amazon.com',
      'en.wikipedia.org',
      'www.bbc.com',
      'login.microsoft.com',
    ];

    it.each(subdomains)('flags %s as safe', (domain) => {
      expect(isSafeSearchSite(domain)).toBe(true);
    });
  });

  describe('country variants return true', () => {
    const countryVariants = [
      'google.co.uk',
      'google.co.in',
      'google.co.jp',
      'google.de',
      'google.fr',
      'google.com.au',
      'google.com.br',
      'google.ca',
      'amazon.co.uk',
      'amazon.co.jp',
      'amazon.de',
      'amazon.fr',
      'amazon.in',
      'bbc.co.uk',
    ];

    it.each(countryVariants)('flags %s as safe', (domain) => {
      expect(isSafeSearchSite(domain)).toBe(true);
    });
  });

  describe('country variants with subdomains', () => {
    it('flags www.google.co.uk', () => {
      expect(isSafeSearchSite('www.google.co.uk')).toBe(true);
    });

    it('flags www.amazon.co.jp', () => {
      expect(isSafeSearchSite('www.amazon.co.jp')).toBe(true);
    });

    it('flags www.bbc.co.uk', () => {
      expect(isSafeSearchSite('www.bbc.co.uk')).toBe(true);
    });
  });

  describe('excluded sites return false', () => {
    const excludedDomains = [
      'reddit.com',
      'twitter.com',
      'x.com',
      'youtube.com',
      'facebook.com',
      'instagram.com',
      'pinterest.com',
      'tumblr.com',
      'tiktok.com',
    ];

    it.each(excludedDomains)('does NOT flag %s as safe', (domain) => {
      expect(isSafeSearchSite(domain)).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('flags LinkedIn.com', () => {
      expect(isSafeSearchSite('LinkedIn.com')).toBe(true);
    });

    it('flags GITHUB.COM', () => {
      expect(isSafeSearchSite('GITHUB.COM')).toBe(true);
    });

    it('flags Google.Com', () => {
      expect(isSafeSearchSite('Google.Com')).toBe(true);
    });
  });

  describe('adult sites return false', () => {
    const adultDomains = ['pornhub.com', 'xvideos.com', 'onlyfans.com'];

    it.each(adultDomains)('does NOT flag %s as safe', (domain) => {
      expect(isSafeSearchSite(domain)).toBe(false);
    });
  });
});
