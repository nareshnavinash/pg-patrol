import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  Sequence,
  staticFile,
} from 'remotion';
import { COLORS } from '../utils/colors';
import { LaptopScreen } from '../components/LaptopScreen';
import { DangerElements } from '../components/DangerElements';

export const TheFear: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps: _fps } = useVideoConfig();

  // Scene is 0-300 frames (0-10s at 30fps)

  // Background darkens over time
  const bgDarkness = interpolate(frame, [0, 150], [0.9, 1], {
    extrapolateRight: 'clamp',
  });

  // Laptop appears with fade
  const laptopOpacity = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Small child silhouette next to laptop
  const childOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Screen starts flickering at frame 115 (before danger at 130)
  const isFlickering = frame > 115;

  // Red vignette builds up in second half
  const vignetteOpacity = interpolate(frame, [135, 250], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out vignette in last 20 frames (280-300) for scene transition
  const vignetteFadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Child shield shrinks when danger appears
  const childScale = interpolate(frame, [150, 250], [1, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const childShake = frame > 180 ? Math.sin(frame * 0.6) * 3 : 0;

  // Content bars smooth fade out instead of hard cut
  const contentOpacity = interpolate(frame, [125, 145], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Content bar heights for variety
  const barHeights = [10, 8, 12, 8, 10];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        opacity: bgDarkness,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.emerald}08 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Laptop centered */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '45%',
          transform: 'translate(-50%, -50%)',
          opacity: laptopOpacity,
        }}
      >
        <LaptopScreen flickering={isFlickering}>
          {/* Content lines (homework) - smooth fade out */}
          {contentOpacity > 0 && (
            <div style={{ padding: 20, width: '100%', opacity: contentOpacity }}>
              {/* Title bar */}
              <div
                style={{
                  width: '50%',
                  height: 14,
                  backgroundColor: COLORS.whiteAlpha50,
                  borderRadius: 5,
                  marginBottom: 16,
                  opacity: interpolate(frame, [30, 40], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              />
              {[0.9, 0.7, 0.8, 0.6, 0.75].map((w, i) => {
                // Staggered fade-in for each bar
                const barOpacity = interpolate(frame, [35 + i * 5, 45 + i * 5], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div
                    key={i}
                    style={{
                      width: `${w * 100}%`,
                      height: barHeights[i],
                      backgroundColor: COLORS.whiteAlpha20,
                      borderRadius: 5,
                      marginBottom: 12,
                      opacity: barOpacity,
                    }}
                  />
                );
              })}
            </div>
          )}
          {/* Danger elements flying in during second half */}
          {frame >= 130 && <DangerElements containerWidth={480} containerHeight={272} />}
        </LaptopScreen>
      </div>

      {/* Child silhouette (small abstract figure) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '72%',
          transform: `translate(-50%, -50%) scale(${childScale})`,
          opacity: childOpacity,
          marginLeft: childShake,
        }}
      >
        <svg width="100" height="130" viewBox="0 0 100 130">
          {/* Head */}
          <circle cx="50" cy="26" r="22" fill={COLORS.emeraldGlow} opacity="0.6" />
          {/* Body */}
          <ellipse cx="50" cy="80" rx="25" ry="35" fill={COLORS.emeraldGlow} opacity="0.6" />
        </svg>
      </div>

      {/* Red vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, ${COLORS.danger}88 100%)`,
          opacity: vignetteOpacity * vignetteFadeOut,
          pointerEvents: 'none',
        }}
      />

      {/* Glitch SFX when danger appears */}
      <Sequence from={140}>
        <Audio src={staticFile('audio/glitch.wav')} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
