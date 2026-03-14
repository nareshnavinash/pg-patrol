import Toggle from './Toggle';

interface HeaderProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function Header({ enabled, onToggle }: HeaderProps) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 flex items-center justify-center ${enabled ? 'shield-pulse' : ''}`}>
          <svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 2 L28 7 L28 15 C28 22.5 22.5 28.5 16 30 C9.5 28.5 4 22.5 4 15 L4 7 Z"
              fill={enabled ? '#4f46e5' : '#9ca3af'}
              className="transition-colors duration-300"
            />
            <text
              x="16"
              y="19"
              textAnchor="middle"
              fill="white"
              fontWeight="bold"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
            >
              PG
            </text>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
            PG Patrol
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Family-friendly filter
          </p>
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onToggle} label="" />
    </div>
  );
}
