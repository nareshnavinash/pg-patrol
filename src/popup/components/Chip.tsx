interface ChipProps {
  label: string;
  color: 'red' | 'green' | 'amber';
  onRemove: () => void;
}

const colorClasses = {
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

export default function Chip({ label, color, onRemove }: ChipProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${colorClasses[color]}`}>
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-70 transition-opacity leading-none"
        aria-label={`Remove ${label}`}
      >
        &times;
      </button>
    </span>
  );
}
