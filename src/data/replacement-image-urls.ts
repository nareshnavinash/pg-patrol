/**
 * Curated CDN URLs for NSFW image replacements.
 * Themes: cute animals + mouth-watering food.
 * Hand-picked from Pexels (free license, no attribution required).
 *
 * No API keys are embedded — these URLs are publicly accessible.
 * Run `scripts/curate-images.mjs` to regenerate with API-sourced URLs.
 */

import type { AspectBucket } from '../assets/replacements/manifest';

export const REPLACEMENT_URLS: Record<AspectBucket, string[]> = {
  landscape: [
    // Animals
    'https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2253275/pexels-photo-2253275.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1490908/pexels-photo-1490908.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/406014/pexels-photo-406014.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/792381/pexels-photo-792381.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2607544/pexels-photo-2607544.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/3397939/pexels-photo-3397939.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1633522/pexels-photo-1633522.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2220337/pexels-photo-2220337.jpeg?auto=compress&cs=tinysrgb&w=600',
    // Food
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/357573/pexels-photo-357573.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1211887/pexels-photo-1211887.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/2641886/pexels-photo-2641886.jpeg?auto=compress&cs=tinysrgb&w=600',
    'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=600',
  ],
  portrait: [
    // Animals
    'https://images.pexels.com/photos/1404819/pexels-photo-1404819.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/2023384/pexels-photo-2023384.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1851164/pexels-photo-1851164.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1661535/pexels-photo-1661535.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1573324/pexels-photo-1573324.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/3777200/pexels-photo-3777200.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/2361952/pexels-photo-2361952.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1440387/pexels-photo-1440387.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/3608263/pexels-photo-3608263.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    // Food
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1565982/pexels-photo-1565982.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1346154/pexels-photo-1346154.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
    'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&w=600&h=900&fit=crop',
  ],
  square: [
    // Animals
    'https://images.pexels.com/photos/160722/cat-tiger-getiegert-feel-at-home-160722.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/45170/kittens-cat-cat-puppy-rush-45170.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/47547/squirrel-animal-cute-rodents-47547.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1440387/pexels-photo-1440387.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/3608263/pexels-photo-3608263.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1076758/pexels-photo-1076758.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/2361952/pexels-photo-2361952.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1404819/pexels-photo-1404819.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/2023384/pexels-photo-2023384.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1851164/pexels-photo-1851164.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    // Food
    'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/2097090/pexels-photo-2097090.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
    'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop',
  ],
};
