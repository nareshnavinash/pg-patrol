import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';

interface ImageFlipProps {
  delay?: number;
}

export const ImageFlip: React.FC<ImageFlipProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const flipProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
    delay: 10,
  });

  const rotateY = interpolate(flipProgress, [0, 1], [0, 180]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        width: 280,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.whiteAlpha80,
          fontFamily: FONTS.body,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Image Filter
      </div>
      <div
        style={{
          position: 'relative',
          width: 200,
          height: 140,
          perspective: '800px',
        }}
      >
        {/* NSFW card (front) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3A1A1A',
            borderRadius: 16,
            border: `2px solid ${COLORS.danger}66`,
            transform: `rotateY(${rotateY}deg)`,
            backfaceVisibility: 'hidden',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="3"
              stroke={COLORS.danger}
              strokeWidth="2"
            />
            <line x1="2" y1="2" x2="22" y2="22" stroke={COLORS.danger} strokeWidth="2" />
            <line x1="22" y1="2" x2="2" y2="22" stroke={COLORS.danger} strokeWidth="2" />
          </svg>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: COLORS.danger,
              fontFamily: FONTS.mono,
            }}
          >
            NSFW
          </span>
        </div>
        {/* Cartoon card (back) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1A3A2A, #1A2E3A)',
            borderRadius: 16,
            border: `2px solid ${COLORS.emerald}44`,
            transform: `rotateY(${180 - rotateY}deg)`,
            backfaceVisibility: 'hidden',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {/* Cute cartoon face */}
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill={COLORS.emerald} opacity="0.2" />
            <circle cx="32" cy="32" r="24" fill={COLORS.emerald} opacity="0.15" />
            <circle cx="22" cy="28" r="4" fill={COLORS.emerald} />
            <circle cx="42" cy="28" r="4" fill={COLORS.emerald} />
            <path
              d="M20 38 Q32 48 44 38"
              fill="none"
              stroke={COLORS.emerald}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.emeraldLight,
              fontFamily: FONTS.body,
            }}
          >
            Safe cartoon
          </span>
        </div>
      </div>
    </div>
  );
};
