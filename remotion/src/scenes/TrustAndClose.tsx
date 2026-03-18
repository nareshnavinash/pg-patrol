import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../utils/colors';
import { Shield } from '../components/Shield';
import { FloatingIcon } from '../components/FloatingIcon';

export const TrustAndClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene runs 615-900 frames (20.5s-30s)
  // Phase 1: Floating icons (frames 0-150, i.e. 20.5-25.5s)
  // Phase 2: Logo + tagline (frames 150-225, i.e. 25.5-28s)
  // Phase 3: Hold + URL (frames 225-285, i.e. 28-30s)

  // Dotted circle connecting the icons
  const circleProgress = interpolate(frame, [30, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transition to final card
  const pullBack = interpolate(frame, [140, 170], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const iconsOpacity = interpolate(pullBack, [0, 1], [1, 0]);
  const finalCardOpacity = interpolate(pullBack, [0.3, 0.8], [0, 1]);

  // Shield pulse in final card
  const pulse = frame > 170 ? 1 + Math.sin((frame - 170) * 0.08) * 0.03 : 1;

  // Tagline typing effect
  const tagline = "Let them explore. We'll keep it clean.";
  const taglineProgress = interpolate(frame, [180, 220], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const visibleChars = Math.floor(taglineProgress * tagline.length);

  // URL fade in
  const urlOpacity = interpolate(frame, [235, 255], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Badge fade in
  const badgeOpacity = interpolate(frame, [245, 265], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Badge entrance spring
  const badgeEntrance = spring({
    frame: Math.max(0, frame - 245),
    fps,
    config: { damping: 10 },
  });

  // Icon positions on the circle using trigonometry
  const circleCenter = { x: width / 2, y: height * 0.45 };
  const circleRadius = 180;
  const iconAngles = [-150, -90, -30]; // degrees, top arc

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.darkBg} 0%, ${COLORS.darkBgMid} 50%, ${COLORS.darkBg} 100%)`,
      }}
    >
      {/* Subtle particle field */}
      {[...Array(20)].map((_, i) => {
        const px = ((i * 97 + 13) % 100) / 100;
        const py = ((i * 61 + 29) % 100) / 100;
        const drift = Math.sin(frame * 0.02 + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${px * 100}%`,
              top: `${py * 100}%`,
              width: 3,
              height: 3,
              borderRadius: '50%',
              backgroundColor: i % 2 === 0 ? COLORS.emeraldGlow : COLORS.goldLight,
              opacity: 0.2 + Math.sin(frame * 0.03 + i * 0.5) * 0.15,
              transform: `translateY(${drift}px)`,
            }}
          />
        );
      })}

      {/* Floating icons with connecting dotted circle */}
      <div style={{ opacity: iconsOpacity }}>
        {/* Dotted circle */}
        <svg
          style={{
            position: 'absolute',
            left: '50%',
            top: '45%',
            transform: 'translate(-50%, -50%)',
          }}
          width="500"
          height="500"
          viewBox="0 0 500 500"
        >
          <circle
            cx="250"
            cy="250"
            r="180"
            fill="none"
            stroke={`${COLORS.emerald}66`}
            strokeWidth="2"
            strokeDasharray="1131"
            strokeDashoffset={1131 * (1 - circleProgress)}
            opacity="0.4"
          />
        </svg>

        <FloatingIcon
          icon="ai"
          label="Local AI"
          delay={5}
          x={circleCenter.x + circleRadius * Math.cos((iconAngles[0] * Math.PI) / 180) - 40}
          y={circleCenter.y + circleRadius * Math.sin((iconAngles[0] * Math.PI) / 180) - 40}
        />
        <FloatingIcon
          icon="lock"
          label="On-Device"
          delay={20}
          x={circleCenter.x + circleRadius * Math.cos((iconAngles[1] * Math.PI) / 180) - 40}
          y={circleCenter.y + circleRadius * Math.sin((iconAngles[1] * Math.PI) / 180) - 40}
        />
        <FloatingIcon
          icon="nocloud"
          label="Zero Data Sent"
          delay={35}
          x={circleCenter.x + circleRadius * Math.cos((iconAngles[2] * Math.PI) / 180) - 40}
          y={circleCenter.y + circleRadius * Math.sin((iconAngles[2] * Math.PI) / 180) - 40}
        />
      </div>

      {/* Final card: Logo + Tagline */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '45%',
          transform: `translate(-50%, -50%) scale(${pulse})`,
          opacity: finalCardOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
        }}
      >
        <Shield size={160} glowing showText={false} />
        <div
          style={{
            fontFamily: FONTS.heading,
            fontSize: 56,
            fontWeight: 800,
            color: COLORS.white,
            textShadow: `0 4px 20px ${COLORS.emerald}88`,
          }}
        >
          PG Patrol
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '72%',
          transform: 'translate(-50%, -50%)',
          opacity: finalCardOpacity,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 30,
            fontWeight: 600,
            color: COLORS.textLight,
            fontStyle: 'italic',
            letterSpacing: '0.02em',
          }}
        >
          {tagline.slice(0, visibleChars)}
          {visibleChars < tagline.length && (
            <span
              style={{
                borderRight: `2px solid ${COLORS.emeraldGlow}`,
                marginLeft: 2,
                opacity: Math.floor(frame / 8) % 2,
              }}
            />
          )}
        </span>
      </div>

      {/* GitHub URL */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 80,
          transform: 'translate(-50%, 0)',
          opacity: urlOpacity,
          fontFamily: FONTS.mono,
          fontSize: 22,
          color: COLORS.whiteAlpha80,
          letterSpacing: '0.05em',
          padding: '8px 24px',
          borderRadius: 12,
          backgroundColor: COLORS.surface,
        }}
      >
        github.com/nareshnavinash/pg-patrol
      </div>

      {/* Free & Open Source badge */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 40,
          transform: `translate(-50%, 0) scale(${badgeEntrance})`,
          opacity: badgeOpacity,
          display: 'flex',
          gap: 8,
        }}
      >
        <div
          style={{
            padding: '6px 20px',
            borderRadius: 20,
            backgroundColor: COLORS.emerald,
            fontSize: 17,
            fontWeight: 700,
            color: COLORS.white,
            fontFamily: FONTS.body,
          }}
        >
          Free & Open Source
        </div>
        <div
          style={{
            padding: '6px 20px',
            borderRadius: 20,
            backgroundColor: COLORS.gold,
            fontSize: 17,
            fontWeight: 700,
            color: COLORS.white,
            fontFamily: FONTS.body,
          }}
        >
          MIT License
        </div>
      </div>
    </AbsoluteFill>
  );
};
