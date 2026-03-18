import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  Sequence,
  staticFile,
} from 'remotion';
import { COLORS, FONTS } from '../utils/colors';
import { Shield } from '../components/Shield';
import { TextSwap } from '../components/TextSwap';
import { ImageFlip } from '../components/ImageFlip';
import { GoodVibesDemo } from '../components/GoodVibesDemo';

export const TheSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene runs 300-615 frames (10s-20.5s)
  // Local frame starts at 0

  // Phase 1: Shield slam (frames 0-60, i.e. 10-12s)
  // Phase 2: Shield glow + text (frames 60-120, i.e. 12-14s)
  // Phase 3: Demo vignettes (frames 120-315, i.e. 14-20.5s)

  // Background transition: darkBg → darkBgMid
  const bgTransition = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Shield slam animation
  const shieldSlam = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 120, mass: 1.5 },
  });

  const shieldScale = interpolate(shieldSlam, [0, 1], [3, 1]);
  const shieldY = interpolate(shieldSlam, [0, 1], [-400, 0]);
  const shieldOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Impact flash
  const flashOpacity = interpolate(frame, [12, 15, 25], [0, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shatter particles (from the danger elements breaking)
  const shatterProgress = interpolate(frame, [12, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shield moves up after slam, text appears below
  const _shieldMoveUp = interpolate(frame, [60, 90], [0, -120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textAppear = spring({
    frame: Math.max(0, frame - 70),
    fps,
    config: { damping: 12 },
  });

  // Text fade out
  const textFadeOut = interpolate(frame, [125, 140], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Demo section slides in
  const demoAppear = interpolate(frame, [120, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shield Y position: slam in (0-30), hold center (30-60), move up (60-90), continue up (90-150)
  const shieldYBase = shieldY; // spring-based slam
  const shieldLift = interpolate(frame, [60, 90], [0, -120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shieldFinalLift = interpolate(frame, [120, 150], [0, -230], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shieldYPos = shieldYBase + shieldLift + shieldFinalLift;

  // Shield scale: slam scale (spring), then shrink for demo section
  const shieldScaleFinal = interpolate(frame, [120, 150], [1, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shieldScaleTotal = shieldScale * shieldScaleFinal;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg,
          rgb(${Math.round(interpolate(bgTransition, [0, 1], [11, 19]))}, ${Math.round(interpolate(bgTransition, [0, 1], [17, 27]))}, ${Math.round(interpolate(bgTransition, [0, 1], [32, 46]))}) 0%,
          rgb(${Math.round(interpolate(bgTransition, [0, 1], [19, 26]))}, ${Math.round(interpolate(bgTransition, [0, 1], [27, 36]))}, ${Math.round(interpolate(bgTransition, [0, 1], [46, 64]))}) 100%)`,
      }}
    >
      {/* Radial glow behind shield */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 800,
          height: 800,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${COLORS.emerald}33 0%, transparent 60%)`,
          opacity: interpolate(frame, [10, 40], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* Shatter particles */}
      {frame >= 12 &&
        frame < 80 &&
        [...Array(16)].map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const dist = shatterProgress * 600;
          const particleX = width / 2 + Math.cos(angle) * dist;
          const particleY = height / 2 + Math.sin(angle) * dist;
          const colors = [COLORS.emerald, COLORS.emeraldLight, COLORS.gold, COLORS.emeraldGlow];
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: particleX,
                top: particleY,
                width: 12 - shatterProgress * 10,
                height: 12 - shatterProgress * 10,
                borderRadius: '50%',
                backgroundColor: colors[i % colors.length],
                opacity: 1 - shatterProgress,
              }}
            />
          );
        })}

      {/* Shield */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translateY(${shieldYPos}px) scale(${shieldScaleTotal})`,
          opacity: shieldOpacity,
        }}
      >
        <Shield size={200} glowing={frame > 30} showText={frame > 75 && frame < 135} />
      </div>

      {/* "PG Patrol" text below shield (appears at 12-14s) */}
      {frame >= 70 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '65%',
            transform: `translate(-50%, -50%) scale(${textAppear})`,
            fontFamily: FONTS.heading,
            fontSize: 48,
            fontWeight: 800,
            color: COLORS.white,
            textShadow: `0 4px 20px ${COLORS.emerald}88`,
            opacity: textAppear * textFadeOut,
          }}
        >
          PG Patrol
        </div>
      )}

      {/* Impact flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.white,
          opacity: flashOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Demo vignettes (14-20.5s) */}
      {frame >= 120 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '55%',
            transform: `translate(-50%, -50%)`,
            display: 'flex',
            gap: 60,
            opacity: demoAppear,
          }}
        >
          <TextSwap delay={0} />
          <ImageFlip delay={20} />
          <GoodVibesDemo delay={40} />
        </div>
      )}

      {/* Small shield + "PG Patrol" at top during demos */}
      {frame >= 135 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 60,
            transform: 'translate(-50%, 0)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: interpolate(frame, [135, 155], [0, 1], {
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <Shield size={40} glowing />
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.white,
              textShadow: `0 2px 10px ${COLORS.emerald}66`,
            }}
          >
            PG Patrol
          </span>
        </div>
      )}

      {/* SFX */}
      <Audio src={staticFile('audio/impact.wav')} startFrom={0} volume={0.7} />
      <Sequence from={15}>
        <Audio src={staticFile('audio/chime.wav')} volume={0.5} />
      </Sequence>
      {/* Pops for each demo transformation */}
      <Sequence from={145}>
        <Audio src={staticFile('audio/pop.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={165}>
        <Audio src={staticFile('audio/pop.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={185}>
        <Audio src={staticFile('audio/pop.wav')} volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};
