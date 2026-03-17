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
            className={`w-8 h-8 flex items-center justify-center ${enabled ? 'shield-pulse' : ''}`}
          >
            <svg viewBox="0 0 512 512" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M256 32 L448 112 L448 240 C448 360 360 456 256 480 C152 456 64 360 64 240 L64 112 Z"
                fill={enabled ? '#4f46e5' : '#9ca3af'}
                className="transition-colors duration-300"
              />
              <g fill="white" fillRule="evenodd">
                <path d="M120 310 V168 H218 C256 168 268 190 268 216 C268 242 256 258 218 258 H168 V310 Z M168 200 H212 C230 200 236 210 236 216 C236 224 230 232 212 232 H168 Z" />
                <path d="M392 198 C376 178 358 168 334 168 C282 168 270 198 270 240 C270 282 282 312 334 312 C358 312 376 302 392 282 V240 H340 V268 C336 276 335 280 334 280 C302 280 296 264 296 240 C296 216 302 200 334 200 C346 200 360 206 376 214 Z" />
              </g>
            </svg>
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
