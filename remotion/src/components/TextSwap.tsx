import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';

interface TextSwapProps {
  delay?: number;
}

export const TextSwap: React.FC<TextSwapProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const flipProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
    delay: 5,
  });

  const rotateX = interpolate(flipProgress, [0, 1], [0, 180]);

  // Sparkle effect after swap
  const sparkleOpacity = interpolate(localFrame, [20, 25, 40], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        Text Filter
      </div>
      <div
        style={{
          position: 'relative',
          width: 240,
          height: 64,
          perspective: '600px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            border: `2px solid ${COLORS.danger}44`,
            transform: `rotateX(${rotateX}deg)`,
            backfaceVisibility: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              fontFamily: FONTS.mono,
              color: COLORS.danger,
            }}
          >
            F**k this
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1A2E1A',
            borderRadius: 16,
            border: `2px solid ${COLORS.emerald}44`,
            transform: `rotateX(${180 - rotateX}deg)`,
            backfaceVisibility: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              fontFamily: FONTS.heading,
              color: COLORS.emerald,
            }}
          >
            Fluffernutter 🧁
          </span>
        </div>
        {/* Sparkles */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const dist = 50 + i * 8;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: COLORS.goldLight,
                transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`,
                opacity: sparkleOpacity,
                boxShadow: `0 0 8px ${COLORS.gold}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
