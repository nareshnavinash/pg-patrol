import Toggle from './Toggle';

interface FeatureBadgeProps {
  label: string;
  active: boolean;
}

function FeatureBadge({ label, active }: FeatureBadgeProps) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        active
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
      }`}
    >
      {label}
    </span>
  );
}

interface HeaderProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  textFilterEnabled?: boolean;
  imageFilterEnabled?: boolean;
  positiveModeEnabled?: boolean;
  mlClassifierEnabled?: boolean;
}

export default function Header({
  enabled,
  onToggle,
  textFilterEnabled = false,
  imageFilterEnabled = false,
  positiveModeEnabled = false,
  mlClassifierEnabled = false,
}: HeaderProps) {
  return (
    <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`relative w-8 h-8 flex items-center justify-center ${enabled ? 'shield-pulse' : ''}`}
          >
            <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16 2 L28 7 L28 15 C28 22.5 22.5 28.5 16 30 C9.5 28.5 4 22.5 4 15 L4 7 Z"
                fill={enabled ? '#4f46e5' : '#9ca3af'}
                className="transition-colors duration-300"
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-white font-bold text-[9px]"
              style={{ paddingBottom: '2px' }}
            >
              PG
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
              PG Patrol
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Family-friendly filter</p>
          </div>
        </div>
        <Toggle enabled={enabled} onChange={onToggle} label="" />
      </div>
      {enabled && (
        <div className="flex gap-1.5 mt-2" data-testid="feature-badges">
          <FeatureBadge label="Text" active={textFilterEnabled} />
          <FeatureBadge label="Images" active={imageFilterEnabled} />
          <FeatureBadge label="Vibes" active={positiveModeEnabled} />
          <FeatureBadge label="AI" active={mlClassifierEnabled} />
        </div>
      )}
    </div>
  );
}
