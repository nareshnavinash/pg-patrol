import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';

interface ShieldProps {
  size?: number;
  glowing?: boolean;
  animateIn?: boolean;
  showText?: boolean;
  color?: string;
}

export const Shield: React.FC<ShieldProps> = ({
  size = 200,
  glowing = false,
  animateIn = false,
  showText = false,
  color = COLORS.emerald,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uniqueId = React.useId();

  const scale = animateIn ? spring({ frame, fps, config: { damping: 8, stiffness: 80 } }) : 1;

  const glowOpacity = glowing ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.8]) : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {glowing && (
        <div
          style={{
            position: 'absolute',
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
            opacity: glowOpacity,
          }}
        />
      )}
      <svg
        viewBox="0 0 100 120"
        width={size}
        height={size * 1.2}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`shieldGrad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.emeraldLight} />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor={COLORS.emeraldDark} />
          </linearGradient>
          <filter id={`shieldShadow-${uniqueId}`}>
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={color} floodOpacity="0.4" />
          </filter>
        </defs>
        <path
          d="M50 5 L90 25 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 25 Z"
          fill={`url(#shieldGrad-${uniqueId})`}
          filter={`url(#shieldShadow-${uniqueId})`}
          stroke={COLORS.emeraldGlow}
          strokeWidth="2"
        />
        {/* Checkmark inside shield */}
        <path
          d="M35 60 L45 72 L68 45"
          fill="none"
          stroke={COLORS.white}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <div
          style={{
            position: 'absolute',
            bottom: -size * 0.25,
            fontFamily: FONTS.heading,
            fontSize: size * 0.22,
            fontWeight: 800,
            color: COLORS.white,
            textAlign: 'center',
            letterSpacing: '0.02em',
            textShadow: `0 2px 10px ${color}88`,
          }}
        >
          PG Patrol
        </div>
      )}
    </div>
  );
};
