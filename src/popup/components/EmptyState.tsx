interface EmptyStateProps {
  type: 'stats' | 'words';
}

const StatsEmptySvg = () => (
  <svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M40 8 L60 16 L60 36 C60 52 50 62 40 66 C30 62 20 52 20 36 L20 16 Z"
      fill="#818CF8"
      opacity="0.15"
    />
    <path
      d="M40 14 L54 20 L54 36 C54 48 47 56 40 60 C33 56 26 48 26 36 L26 20 Z"
      stroke="#4F46E5"
      strokeWidth="2"
      fill="none"
    />
    <path
      d="M32 38 L38 44 L50 32"
      stroke="#4F46E5"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WordsEmptySvg = () => (
  <svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="48" height="48" rx="6" fill="#818CF8" opacity="0.15" />
    <rect
      x="20"
      y="20"
      width="40"
      height="40"
      rx="4"
      stroke="#4F46E5"
      strokeWidth="2"
      fill="none"
    />
    <line x1="28" y1="32" x2="52" y2="32" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="40" x2="46" y2="40" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="48" x2="40" y2="48" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
    <circle cx="54" cy="54" r="10" fill="white" stroke="#4F46E5" strokeWidth="2" />
    <line x1="50" y1="54" x2="58" y2="54" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
    <line x1="54" y1="50" x2="54" y2="58" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function EmptyState({ type }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-2">
      {type === 'stats' ? <StatsEmptySvg /> : <WordsEmptySvg />}
      <p className="text-xs text-gray-400 mt-1 text-center">
        {type === 'stats' ? 'All clean! Browse a page to start' : 'Add your first word above'}
      </p>
    </div>
  );
}
