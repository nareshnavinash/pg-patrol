import { useState } from 'preact/hooks';
import Toggle from './Toggle';
import type { PGPatrolSettings, Sensitivity } from '../../shared/types';

interface SettingsProps {
  settings: PGPatrolSettings;
  onUpdate: (partial: Partial<PGPatrolSettings>) => void;
  showToast?: (message: string) => void;
}

const SENSITIVITY_OPTIONS: Array<{ value: Sensitivity; label: string; description: string }> = [
  { value: 'mild', label: 'Mild', description: 'Only the most offensive words' },
  { value: 'moderate', label: 'Moderate', description: 'Standard profanity (recommended)' },
  { value: 'strict', label: 'Strict', description: 'Catches everything including borderline' },
];

const SENSITIVITY_BAR: Record<Sensitivity, [string, string, string]> = {
  mild: ['bg-green-500', 'bg-gray-200 dark:bg-gray-700', 'bg-gray-200 dark:bg-gray-700'],
  moderate: ['bg-green-500', 'bg-yellow-500', 'bg-gray-200 dark:bg-gray-700'],
  strict: ['bg-green-500', 'bg-yellow-500', 'bg-red-500'],
};

export default function Settings({ settings, onUpdate, showToast }: SettingsProps) {
  const barColors = SENSITIVITY_BAR[settings.sensitivity];
  const [sliderValue, setSliderValue] = useState(settings.customThreshold ?? 0.15);

  return (
    <div className="mt-3 space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Settings
      </h2>

      <Toggle
        enabled={settings.textFilterEnabled}
        onChange={(enabled) => {
          onUpdate({ textFilterEnabled: enabled });
          showToast?.(enabled ? 'Word filter enabled' : 'Word filter disabled');
        }}
        label="18+ Word Filter"
        description="Replace swear words with funny alternatives"
      />

      <Toggle
        enabled={settings.positiveModeEnabled}
        onChange={(enabled) => {
          onUpdate({ positiveModeEnabled: enabled });
          showToast?.(enabled ? 'Good Vibes Mode enabled' : 'Good Vibes Mode disabled');
        }}
        label="Good Vibes Mode"
        description="Hide distressing news behind a calm overlay"
      />

      <Toggle
        enabled={settings.imageFilterEnabled}
        onChange={(enabled) => {
          onUpdate({ imageFilterEnabled: enabled });
          showToast?.(enabled ? 'Image filtering enabled' : 'Image filtering disabled');
        }}
        label="Image Filtering (Research Preview)"
        description="Detect and replace NSFW images — experimental, may affect video playback"
      />

      <Toggle
        enabled={settings.mlClassifierEnabled}
        onChange={(enabled) => {
          onUpdate({ mlClassifierEnabled: enabled });
          showToast?.(enabled ? 'AI detection enabled' : 'AI detection disabled');
        }}
        label="AI-Enhanced Detection"
        description="Use ML model for nuanced toxicity detection (~25 MB bundled)"
      />

      <div className="pt-2">
        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Sensitivity</label>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {SENSITIVITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onUpdate({ sensitivity: option.value, customThreshold: null });
                setSliderValue(
                  option.value === 'strict' ? 0.3 : option.value === 'moderate' ? 0.6 : 0.85,
                );
                showToast?.(`Sensitivity set to ${option.label}`);
              }}
              className={`
                px-2 py-1.5 text-xs rounded-md border transition-colors
                ${
                  settings.sensitivity === option.value && settings.customThreshold == null
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                }
              `}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sensitivity bar */}
        <div className="flex gap-1 mt-1.5">
          {barColors.map((color, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-colors duration-300 ${color}`}
            />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-1">
          {settings.customThreshold != null
            ? `Custom threshold: ${settings.customThreshold.toFixed(2)}`
            : SENSITIVITY_OPTIONS.find((o) => o.value === settings.sensitivity)?.description}
        </p>

        {/* NSFW Threshold slider */}
        <div className="mt-2 px-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              NSFW Threshold
            </label>
            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
              {sliderValue.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sliderValue}
            onInput={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              setSliderValue(val);
              onUpdate({ customThreshold: val });
            }}
            className="w-full h-1.5 mt-1 accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>0.00 (flag all)</span>
            <span>1.00 (flag none)</span>
          </div>
          {settings.customThreshold != null && (
            <button
              onClick={() => {
                onUpdate({ customThreshold: null });
                setSliderValue(0.15);
                showToast?.('Threshold reset to default (0.15)');
              }}
              className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* Developer Mode */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <Toggle
          enabled={settings.developerMode}
          onChange={(enabled) => {
            onUpdate({ developerMode: enabled });
            showToast?.(enabled ? 'Developer mode enabled' : 'Developer mode disabled');
          }}
          label="Developer Mode"
          description="Show NSFW scores on images and log scan decisions"
        />
      </div>
    </div>
  );
}
