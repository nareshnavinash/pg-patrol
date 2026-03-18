import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';

interface FloatingIconProps {
  icon: 'ai' | 'lock' | 'nocloud';
  label: string;
  delay?: number;
  x: number;
  y: number;
}

const IconSvg: React.FC<{ type: string; size: number }> = ({ type, size }) => {
  if (type === 'ai') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect
          x="4"
          y="8"
          width="40"
          height="32"
          rx="4"
          stroke={COLORS.emeraldLight}
          strokeWidth="2.5"
        />
        <circle cx="16" cy="24" r="4" fill={COLORS.emeraldLight} />
        <circle cx="32" cy="24" r="4" fill={COLORS.emeraldLight} />
        <line x1="20" y1="24" x2="28" y2="24" stroke={COLORS.emeraldLight} strokeWidth="2" />
        <circle cx="24" cy="18" r="2" fill={COLORS.emeraldGlow} />
        <line x1="16" y1="20" x2="24" y2="18" stroke={COLORS.emeraldGlow} strokeWidth="1.5" />
        <line x1="32" y1="20" x2="24" y2="18" stroke={COLORS.emeraldGlow} strokeWidth="1.5" />
      </svg>
    );
  }
  if (type === 'lock') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect
          x="10"
          y="22"
          width="28"
          height="20"
          rx="4"
          stroke={COLORS.emerald}
          strokeWidth="2.5"
        />
        <path
          d="M16 22V16C16 11.6 19.6 8 24 8C28.4 8 32 11.6 32 16V22"
          stroke={COLORS.emerald}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="24" cy="32" r="3" fill={COLORS.emeraldLight} />
      </svg>
    );
  }
  // nocloud
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path
        d="M12 32C8.7 32 6 29.3 6 26C6 23.2 7.9 20.8 10.5 20.1C10.2 19.4 10 18.7 10 18C10 14.7 12.7 12 16 12C16.8 12 17.6 12.2 18.3 12.5C20 9.4 23.3 7.5 27 8C31.4 8.6 34.8 12.3 35 16.7C38.3 17.3 41 20.3 41 24C41 28.4 37.4 32 33 32"
        stroke={COLORS.orange}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="8"
        x2="40"
        y2="40"
        stroke={COLORS.danger}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const FloatingIcon: React.FC<FloatingIconProps> = ({ icon, label, delay = 0, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 10, stiffness: 80 },
  });

  const bounce = Math.sin((frame - delay) * 0.08) * 4;
  const scale = interpolate(entrance, [0, 1], [0.3, 1]);
  const opacity = interpolate(entrance, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (entrance > 0.5 ? bounce : 0),
        transform: `scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: COLORS.whiteAlpha20,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${COLORS.whiteAlpha20}`,
        }}
      >
        <IconSvg type={icon} size={48} />
      </div>
      <span
        style={{
          fontSize: 19,
          fontWeight: 700,
          color: COLORS.white,
          fontFamily: FONTS.body,
          textShadow: `0 2px 8px rgba(0,0,0,0.3)`,
        }}
      >
        {label}
      </span>
    </div>
  );
};
