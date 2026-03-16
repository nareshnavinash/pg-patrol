import { useState, useEffect } from 'preact/hooks';
import { MessageType } from '../../shared/types';
import type { FilterStateResponse } from '../../shared/types';

export default function RevealToggle() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId) {
          const response: FilterStateResponse = await chrome.tabs.sendMessage(tabId, {
            type: MessageType.GET_FILTER_STATE,
          });
          if (response?.filteringPaused) {
            setRevealed(true);
          }
        }
      } catch {
        // Tab might not have content script
      }
    })();
  }, []);

  const toggleReveal = async () => {
    const newState = !revealed;
    setRevealed(newState);

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.TOGGLE_FILTERING,
        data: { enabled: !newState },
      });
    } catch {
      /* content script may be unloading */
    }

    chrome.tabs.reload(tabId);
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={toggleReveal}
        className={`
          w-full text-sm py-2 px-3 rounded-lg transition-colors
          ${
            revealed
              ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500 border border-red-700 dark:border-red-500'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700'
          }
        `}
      >
        {revealed ? 'Filtering paused — Click to resume' : 'Reveal original content'}
      </button>
    </div>
  );
}
