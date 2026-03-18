import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from './utils/colors';

export const Banner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Banner: 800x200, 20fps, 5s (100 frames)

  // Shield bounces in from left (0-20 frames, 0-1s)
  const shieldEntrance = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 100 },
  });

  const shieldX = interpolate(shieldEntrance, [0, 1], [-100, 24]);
  const shieldScale = interpolate(shieldEntrance, [0, 1], [0.3, 1]);

  // Tagline types out (20-50 frames, 1-2.5s)
  const tagline = "Let them explore. We'll keep it clean.";
  const typeProgress = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const visibleChars = Math.floor(typeProgress * tagline.length);

  // Icons float up (50-80 frames, 2.5-4s)
  const icon1 = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 10 } });
  const icon2 = spring({ frame: Math.max(0, frame - 58), fps, config: { damping: 10 } });
  const icon3 = spring({ frame: Math.max(0, frame - 66), fps, config: { damping: 10 } });

  // Pulse/glow at end (80-100 frames, 4-5s)
  const pulse = frame > 80 ? 1 + Math.sin((frame - 80) * 0.15) * 0.05 : 1;

  // Floating sparkle particles
  const sparkleOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Frame-based cursor blink (since CSS animations don't work in Remotion)
  const cursorOpacity = Math.floor(frame / 6) % 2;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darkBg} 0%, ${COLORS.darkBgMid} 50%, ${COLORS.surface} 100%)`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Subtle pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.emeraldGlow}15 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Shield logo */}
      <div
        style={{
          position: 'absolute',
          left: shieldX,
          top: '50%',
          transform: `translateY(-50%) scale(${shieldScale * pulse})`,
        }}
      >
        <svg viewBox="0 0 100 120" width="56" height="67" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bannerShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={COLORS.emeraldLight} />
              <stop offset="50%" stopColor={COLORS.emerald} />
              <stop offset="100%" stopColor={COLORS.emeraldDark} />
            </linearGradient>
          </defs>
          <path
            d="M50 5 L90 25 L90 60 C90 85 70 105 50 115 C30 105 10 85 10 60 L10 25 Z"
            fill="url(#bannerShieldGrad)"
            stroke={COLORS.emeraldGlow}
            strokeWidth="3"
          />
          <path
            d="M35 60 L45 72 L68 45"
            fill="none"
            stroke={COLORS.white}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* PG Patrol text */}
      <div
        style={{
          position: 'absolute',
          left: 95,
          top: '38%',
          transform: `translateY(-50%) scale(${shieldScale})`,
          opacity: shieldEntrance,
          fontFamily: FONTS.heading,
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.white,
          textShadow: `0 2px 10px ${COLORS.emerald}88`,
        }}
      >
        PG Patrol
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          left: 95,
          top: '66%',
          transform: 'translateY(-50%)',
          fontFamily: FONTS.body,
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.textMuted,
          fontStyle: 'italic',
          opacity: shieldEntrance > 0.8 ? 1 : 0,
        }}
      >
        {tagline.slice(0, visibleChars)}
        {visibleChars < tagline.length && visibleChars > 0 && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              backgroundColor: COLORS.emeraldGlow,
              marginLeft: 1,
              verticalAlign: 'text-bottom',
              opacity: cursorOpacity,
            }}
          />
        )}
      </div>

      {/* Feature icons on the right */}
      <div
        style={{
          position: 'absolute',
          right: 40,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          gap: 24,
          alignItems: 'center',
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            transform: `scale(${icon1}) translateY(${(1 - icon1) * 30}px)`,
            opacity: icon1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: COLORS.whiteAlpha20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🛡️
          </div>
          <span
            style={{
              fontSize: 10,
              color: COLORS.whiteAlpha80,
              fontFamily: 'system-ui',
              fontWeight: 600,
            }}
          >
            Safe
          </span>
        </div>

        {/* Smiley icon */}
        <div
          style={{
            transform: `scale(${icon2}) translateY(${(1 - icon2) * 30}px)`,
            opacity: icon2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: COLORS.whiteAlpha20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            😄
          </div>
          <span
            style={{
              fontSize: 10,
              color: COLORS.whiteAlpha80,
              fontFamily: 'system-ui',
              fontWeight: 600,
            }}
          >
            Funny
          </span>
        </div>

        {/* Lock icon */}
        <div
          style={{
            transform: `scale(${icon3}) translateY(${(1 - icon3) * 30}px)`,
            opacity: icon3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: COLORS.whiteAlpha20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🔒
          </div>
          <span
            style={{
              fontSize: 10,
              color: COLORS.whiteAlpha80,
              fontFamily: 'system-ui',
              fontWeight: 600,
            }}
          >
            Private
          </span>
        </div>
      </div>

      {/* Sparkles */}
      {[...Array(8)].map((_, i) => {
        const sx = 200 + ((i * 73 + 17) % (width - 250));
        const sy = 20 + ((i * 47 + 31) % (height - 40));
        const drift = Math.sin(frame * 0.05 + i * 1.2) * 8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sx,
              top: sy + drift,
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: i % 2 === 0 ? COLORS.emeraldGlow : COLORS.goldLight,
              opacity: sparkleOpacity * (0.4 + Math.sin(frame * 0.08 + i) * 0.3),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
