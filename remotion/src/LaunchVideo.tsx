import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { COLORS } from './utils/colors';
import { TheFear } from './scenes/TheFear';
import { TheSolution } from './scenes/TheSolution';
import { TrustAndClose } from './scenes/TrustAndClose';

export const LaunchVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Music volume: louder to compensate for no VO, fades out at the end
  const musicVolume = interpolate(frame, [0, 30, 840, 900], [0, 0.25, 0.25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.darkBg }}>
      {/* Background music — plays throughout */}
      <Audio src={staticFile('audio/music.wav')} volume={musicVolume} />

      {/* Scene 1: The Fear (0-10s, frames 0-300) */}
      <Sequence from={0} durationInFrames={300}>
        <TheFear />
      </Sequence>

      {/* Scene 2: The Solution (10-20.5s, frames 300-615) */}
      <Sequence from={300} durationInFrames={315}>
        <TheSolution />
      </Sequence>

      {/* Scene 3: Trust & Close (20.5-30s, frames 615-900) */}
      <Sequence from={615} durationInFrames={285}>
        <TrustAndClose />
      </Sequence>
    </AbsoluteFill>
  );
};
