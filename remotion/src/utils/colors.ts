export const COLORS = {
  // Backgrounds
  darkBg: '#0B1120',
  darkBgMid: '#131B2E',
  surface: '#1A2440',
  brightBg: '#F0FDF4',

  // Primary (safety/trust)
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldGlow: '#6EE7B7',
  emeraldDark: '#059669',

  // Secondary (premium warmth)
  gold: '#F59E0B',
  goldLight: '#FBBF24',

  // Danger
  danger: '#EF4444',
  dangerDark: '#DC2626',
  orange: '#F97316',

  // Text
  textLight: '#F1F5F9',
  textMuted: '#94A3B8',
  textDark: '#0F172A',

  // Utility
  white: '#FFFFFF',
  whiteAlpha80: 'rgba(255,255,255,0.8)',
  whiteAlpha50: 'rgba(255,255,255,0.5)',
  whiteAlpha20: 'rgba(255,255,255,0.2)',
};

export const FONTS = {
  heading: "'Nunito', 'Quicksand', system-ui, -apple-system, sans-serif",
  body: "'Nunito', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

export const FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_DURATION_S = 30;
export const VIDEO_DURATION_FRAMES = VIDEO_DURATION_S * FPS; // 900

export const BANNER_WIDTH = 800;
export const BANNER_HEIGHT = 200;
export const BANNER_FPS = 20;
export const BANNER_DURATION_S = 5;
export const BANNER_DURATION_FRAMES = BANNER_DURATION_S * BANNER_FPS; // 100
