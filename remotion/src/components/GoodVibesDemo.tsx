import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';

interface GoodVibesDemoProps {
  delay?: number;
}

export const GoodVibesDemo: React.FC<GoodVibesDemoProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const fadeProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
    delay: 15,
  });

  const badOpacity = interpolate(fadeProgress, [0, 1], [1, 0], {
    extrapolateRight: 'clamp',
  });
  const goodOpacity = interpolate(fadeProgress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
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
        Good Vibes
      </div>
      <div
        style={{
          position: 'relative',
          width: 220,
          height: 100,
        }}
      >
        {/* Angry/harsh content block */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#2A1A1A',
            borderRadius: 16,
            border: `2px solid ${COLORS.danger}44`,
            opacity: badOpacity,
            flexDirection: 'column',
            gap: 6,
            padding: 12,
          }}
        >
          <div
            style={{
              width: '90%',
              height: 8,
              backgroundColor: COLORS.danger,
              borderRadius: 4,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              width: '70%',
              height: 8,
              backgroundColor: COLORS.danger,
              borderRadius: 4,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              width: '80%',
              height: 8,
              backgroundColor: COLORS.danger,
              borderRadius: 4,
              opacity: 0.4,
            }}
          />
          <span
            style={{ fontSize: 11, color: COLORS.danger, fontWeight: 700, fontFamily: FONTS.mono }}
          >
            Distressing content
          </span>
        </div>
        {/* Soft green overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${COLORS.emerald}22, ${COLORS.emeraldDark}22)`,
            borderRadius: 16,
            border: `2px solid ${COLORS.emerald}44`,
            opacity: goodOpacity,
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 32 }}>🌿</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.emeraldLight,
              fontFamily: FONTS.heading,
            }}
          >
            Content softened
          </span>
        </div>
      </div>
    </div>
  );
};
