import { useEffect, useState, useRef } from 'preact/hooks';
import { MessageType } from '../../shared/types';
import EmptyState from './EmptyState';

interface StatsCardProps {
  totalWordsReplaced: number;
  totalImagesReplaced: number;
}

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;

    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();
    let raf: number;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(start + (target - start) * eased));

      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

const WordIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" className="inline-block mr-1 -mt-0.5">
    <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4 6h8M4 9h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" className="inline-block mr-1 -mt-0.5">
    <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M1 12l4-4 3 3 2-2 5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function StatsCard({ totalWordsReplaced, totalImagesReplaced }: StatsCardProps) {
  const [pageWords, setPageWords] = useState(0);
  const [pageImages, setPageImages] = useState(0);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.runtime
          .sendMessage({ type: MessageType.GET_TAB_STATS, tabId })
          .then((response) => {
            if (response) {
              setPageWords(response.wordsReplaced ?? 0);
              setPageImages(response.imagesReplaced ?? 0);
            }
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const animPageWords = useCountUp(pageWords);
  const animPageImages = useCountUp(pageImages);
  const animTotalWords = useCountUp(totalWordsReplaced);
  const animTotalImages = useCountUp(totalImagesReplaced);

  const allZero = pageWords === 0 && pageImages === 0 && totalWordsReplaced === 0 && totalImagesReplaced === 0;

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 mt-3 shadow-sm dark:ring-1 dark:ring-indigo-500/20">
      <h2 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">
        Stats
      </h2>
      {allZero ? (
        <EmptyState type="stats" />
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {animPageWords}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <WordIcon />Words (this page)
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {animTotalWords}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <WordIcon />Words (all time)
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {animPageImages}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <ImageIcon />Images (this page)
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {animTotalImages}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <ImageIcon />Images (all time)
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
