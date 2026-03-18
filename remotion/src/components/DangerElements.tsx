import React from 'react';
import { interpolate, useCurrentFrame, random } from 'remotion';
import { COLORS } from '../utils/colors';

const DANGER_ITEMS = [
  { text: '!@#$%', color: COLORS.danger },
  { text: '\u{1F480}', color: COLORS.dangerDark },
  { text: 'NSFW', color: COLORS.danger },
  { text: '\u26A0\uFE0F', color: COLORS.orange },
  { text: '!@#$', color: COLORS.dangerDark },
  { text: '\u{1F51E}', color: COLORS.danger },
  { text: '***', color: COLORS.orange },
  { text: '\u2620\uFE0F', color: COLORS.dangerDark },
  { text: '#$@!', color: COLORS.danger },
  { text: '\u26D4', color: COLORS.dangerDark },
  { text: '!#@%', color: COLORS.orange },
  { text: '\u{1F6AB}', color: COLORS.danger },
];

interface DangerElementsProps {
  containerWidth?: number;
  containerHeight?: number;
}

export const DangerElements: React.FC<DangerElementsProps> = ({
  containerWidth = 480,
  containerHeight = 272,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}
    >
      {DANGER_ITEMS.map((item, i) => {
        const seed = i * 137;
        const startFrame = Math.floor(random(`start-${i}`) * 20);
        const localFrame = Math.max(0, frame - startFrame);

        // Each element flies in from a random edge
        const angle = random(`angle-${i}`) * Math.PI * 2;
        const startX = containerWidth / 2 + Math.cos(angle) * (containerWidth * 0.8);
        const startY = containerHeight / 2 + Math.sin(angle) * (containerHeight * 0.8);
        const endX = containerWidth / 2 + (random(`ex-${i}`) - 0.5) * containerWidth * 0.6;
        const endY = containerHeight / 2 + (random(`ey-${i}`) - 0.5) * containerHeight * 0.5;

        const progress = interpolate(localFrame, [0, 40], [0, 1], {
          extrapolateRight: 'clamp',
        });

        const x = interpolate(progress, [0, 1], [startX, endX]);
        const y = interpolate(progress, [0, 1], [startY, endY]);
        const opacity = interpolate(localFrame, [0, 10, 40, 60], [0, 1, 1, 0.7], {
          extrapolateRight: 'clamp',
        });
        const rotation = interpolate(localFrame, [0, 60], [0, (random(`rot-${i}`) - 0.5) * 90]);
        const scale = interpolate(progress, [0, 0.5, 1], [0.3, 1.2, 1]);

        // Pulsing/shaking effect
        const shake = Math.sin(localFrame * 0.5 + seed) * 3;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + shake,
              top: y,
              transform: `rotate(${rotation}deg) scale(${scale})`,
              opacity,
              fontSize: 32 + random(`size-${i}`) * 24,
              fontWeight: 900,
              fontFamily: 'monospace',
              color: item.color,
              textShadow: `0 0 20px ${item.color}88`,
              userSelect: 'none',
            }}
          >
            {item.text}
          </div>
        );
      })}
    </div>
  );
};
