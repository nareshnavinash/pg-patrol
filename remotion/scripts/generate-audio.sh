#!/bin/bash
# Generate all audio assets for PG Patrol launch video
# Requires: sox
# No voiceover — music-driven with SFX only

set -e

AUDIO_DIR="$(dirname "$0")/../public/audio"
mkdir -p "$AUDIO_DIR"

echo "=== Generating background music ==="

# Dark/tense section (0-10s): C minor ambient pad — darker, more volume for music-driven feel
sox -n /tmp/dark-c2.wav synth 10 sine 65.41 vol 0.15 fade t 2 10 2
sox -n /tmp/dark-eb2.wav synth 10 sine 77.78 vol 0.12 fade t 2 10 2
sox -n /tmp/dark-g2.wav synth 10 sine 98.00 vol 0.10 fade t 3 10 2
sox -m /tmp/dark-c2.wav /tmp/dark-eb2.wav /tmp/dark-g2.wav /tmp/dark-pad.wav

# Transition swell (10-12s): rising tone matching scene change
sox -n /tmp/transition.wav synth 2 sine 65.41:261.63 vol 0.15 fade t 0.5 2 0.5

# Bright/hopeful section (12-22s): C major ambient pad — brighter, more energy
sox -n /tmp/bright-c3.wav synth 10 sine 130.81 vol 0.14 fade t 2 10 2
sox -n /tmp/bright-e3.wav synth 10 sine 164.81 vol 0.10 fade t 2 10 2
sox -n /tmp/bright-g3.wav synth 10 sine 196.00 vol 0.10 fade t 2 10 2
sox -n /tmp/bright-c4.wav synth 10 sine 261.63 vol 0.06 fade t 3 10 2
sox -m /tmp/bright-c3.wav /tmp/bright-e3.wav /tmp/bright-g3.wav /tmp/bright-c4.wav /tmp/bright-pad.wav

# Uplifting close section (22-32s): higher register, warm resolution
sox -n /tmp/close-e3.wav synth 10 sine 164.81 vol 0.12 fade t 2 10 3
sox -n /tmp/close-g3.wav synth 10 sine 196.00 vol 0.10 fade t 2 10 3
sox -n /tmp/close-b3.wav synth 10 sine 246.94 vol 0.08 fade t 2 10 3
sox -n /tmp/close-e4.wav synth 10 sine 329.63 vol 0.05 fade t 3 10 3
sox -m /tmp/close-e3.wav /tmp/close-g3.wav /tmp/close-b3.wav /tmp/close-e4.wav /tmp/close-pad.wav

# Concatenate all sections
sox /tmp/dark-pad.wav /tmp/transition.wav /tmp/bright-pad.wav /tmp/close-pad.wav "$AUDIO_DIR/music.wav"

echo "=== Generating sound effects ==="

# Glitch (0.3s)
sox -n "$AUDIO_DIR/glitch.wav" synth 0.3 brownnoise vol 0.3 tremolo 50 90 fade t 0 0.3 0.1

# Impact (1s)
sox -n "$AUDIO_DIR/impact.wav" synth 1 sine 40 vol 0.5 fade t 0 1 0.8 reverb 80

# Chime (1s)
sox -n "$AUDIO_DIR/chime.wav" synth 1 sine 880 vol 0.3 fade t 0 1 0.7 reverb 90

# Pop (0.2s)
sox -n "$AUDIO_DIR/pop.wav" synth 0.2 sine 440 vol 0.4 fade t 0 0.2 0.15

# Cleanup temp files
rm -f /tmp/dark-*.wav /tmp/bright-*.wav /tmp/close-*.wav /tmp/transition.wav

echo "=== Done! Audio files in $AUDIO_DIR ==="
ls -lh "$AUDIO_DIR"
