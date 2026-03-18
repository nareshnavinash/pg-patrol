import { Composition } from 'remotion';
import { LaunchVideo } from './LaunchVideo';
import { Banner } from './Banner';
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  FPS,
  VIDEO_DURATION_FRAMES,
  BANNER_WIDTH,
  BANNER_HEIGHT,
  BANNER_FPS,
  BANNER_DURATION_FRAMES,
} from './utils/colors';

export const Root: React.FC = () => {
  return (
    <>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Quicksand:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');`}
      </style>
      <Composition
        id="LaunchVideo"
        component={LaunchVideo}
        durationInFrames={VIDEO_DURATION_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Banner"
        component={Banner}
        durationInFrames={BANNER_DURATION_FRAMES}
        fps={BANNER_FPS}
        width={BANNER_WIDTH}
        height={BANNER_HEIGHT}
      />
    </>
  );
};
