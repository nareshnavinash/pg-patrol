import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS } from '../utils/colors';

interface LaptopScreenProps {
  flickering?: boolean;
  children?: React.ReactNode;
}

export const LaptopScreen: React.FC<LaptopScreenProps> = ({ flickering = false, children }) => {
  const frame = useCurrentFrame();

  const flicker = flickering
    ? interpolate(Math.sin(frame * 0.8) + Math.sin(frame * 1.3), [-2, 2], [0.6, 1])
    : 1;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: 480,
          height: 300,
          backgroundColor: COLORS.darkBgMid,
          borderRadius: '16px 16px 0 0',
          border: `3px solid ${COLORS.surface}`,
          overflow: 'hidden',
          position: 'relative',
          opacity: flicker,
          boxShadow: `0 0 60px ${COLORS.emerald}33`,
        }}
      >
        {/* Browser chrome */}
        <div
          style={{
            height: 28,
            backgroundColor: COLORS.surface,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 10,
            gap: 6,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981' }} />
          <div
            style={{
              marginLeft: 12,
              flex: 1,
              height: 16,
              backgroundColor: COLORS.darkBg,
              borderRadius: 4,
              marginRight: 10,
            }}
          />
        </div>
        {/* Content area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 272,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      </div>
      {/* Laptop base */}
      <div
        style={{
          width: 560,
          height: 16,
          background: `linear-gradient(180deg, ${COLORS.surface}, ${COLORS.darkBgMid})`,
          borderRadius: '0 0 8px 8px',
        }}
      />
      {/* Glow under laptop */}
      <div
        style={{
          width: 400,
          height: 8,
          background: `radial-gradient(ellipse, ${COLORS.emerald}44, transparent)`,
          marginTop: 2,
        }}
      />
    </div>
  );
};
