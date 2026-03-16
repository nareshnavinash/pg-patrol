import { useState, useEffect } from 'preact/hooks';
import CollapsibleSection from './CollapsibleSection';
import { MessageType } from '../../shared/types';
import type { ActivityEntry } from '../../shared/types';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function TypeIcon({ type }: { type: ActivityEntry['type'] }) {
  if (type === 'word') {
    return (
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        className="text-indigo-500 shrink-0"
      >
        <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm3 2a.75.75 0 000 1.5h6a.75.75 0 000-1.5H5zm0 3a.75.75 0 000 1.5h4a.75.75 0 000-1.5H5z" />
      </svg>
    );
  }
  if (type === 'image') {
    return (
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        className="text-rose-500 shrink-0"
      >
        <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 5.5V12h8v-1.5l-2-2-1.5 1.5L6 7.5l-2 2zM10.5 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
      </svg>
    );
  }
  // block
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      className="text-amber-500 shrink-0"
    >
      <path d="M8 1l2.09 4.26L15 6.27l-3.5 3.42L12.18 15 8 12.77 3.82 15l.68-5.31L1 6.27l4.91-.71z" />
    </svg>
  );
}

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      chrome.runtime.sendMessage(
        { type: MessageType.GET_ACTIVITY_LOG, tabId },
        (response: ActivityEntry[] | undefined) => {
          if (Array.isArray(response)) {
            setEntries(response);
          }
        },
      );
    });
  }, []);

  return (
    <CollapsibleSection title="Activity Log" defaultOpen={false} badge={entries.length}>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
          No activity on this page yet
        </p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1 py-1">
          {[...entries].reverse().map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <TypeIcon type={entry.type} />
              <div className="min-w-0 flex-1">
                <span className="text-gray-700 dark:text-gray-300 break-all">
                  {entry.original.length > 40
                    ? entry.original.slice(0, 40) + '...'
                    : entry.original}
                </span>
                {entry.replacement && (
                  <span className="text-green-600 dark:text-green-400"> → {entry.replacement}</span>
                )}
                {entry.category && (
                  <span className="text-gray-400 dark:text-gray-500"> ({entry.category})</span>
                )}
              </div>
              <span className="text-gray-400 dark:text-gray-600 whitespace-nowrap shrink-0">
                {formatTimeAgo(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
