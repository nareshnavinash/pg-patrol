import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { PGPatrolSettings } from '../../shared/types';
import Chip from './Chip';
import EmptyState from './EmptyState';

interface CustomWordsProps {
  settings: PGPatrolSettings;
  onUpdate: (partial: Partial<PGPatrolSettings>) => void;
  showToast?: (message: string) => void;
}

type WordCategory = 'blocked' | 'safe';

export default function CustomWords({ settings, onUpdate, showToast }: CustomWordsProps) {
  const [category, setCategory] = useState<WordCategory>('blocked');
  const [inputValue, setInputValue] = useState('');

  const words = category === 'blocked' ? settings.customBlockedWords : settings.customSafeWords;

  const settingsKey = category === 'blocked' ? 'customBlockedWords' : 'customSafeWords';

  const addWord = () => {
    const word = inputValue.trim().toLowerCase();
    if (!word || words.includes(word)) {
      setInputValue('');
      return;
    }
    onUpdate({ [settingsKey]: [...words, word] });
    setInputValue('');
    showToast?.(`Added "${word}" to ${category} words`);
  };

  const removeWord = (word: string) => {
    onUpdate({ [settingsKey]: words.filter((w) => w !== word) });
    showToast?.(`Removed "${word}" from ${category} words`);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  };

  const totalCustom = settings.customBlockedWords.length + settings.customSafeWords.length;

  return (
    <div className="mt-3 space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Custom Words
        {totalCustom > 0 && <span className="ml-1 text-indigo-500">({totalCustom})</span>}
      </h2>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
        {/* Pill-shaped category toggle */}
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
          <button
            onClick={() => setCategory('blocked')}
            className={`flex-1 text-xs py-1 rounded-full transition-colors ${
              category === 'blocked'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Blocked ({settings.customBlockedWords.length})
          </button>
          <button
            onClick={() => setCategory('safe')}
            className={`flex-1 text-xs py-1 rounded-full transition-colors ${
              category === 'safe'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Safe ({settings.customSafeWords.length})
          </button>
        </div>

        {/* Chips */}
        {words.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {words.map((word) => (
              <Chip
                key={word}
                label={word}
                color={category === 'blocked' ? 'red' : 'green'}
                onRemove={() => removeWord(word)}
              />
            ))}
          </div>
        )}

        {words.length === 0 && <EmptyState type="words" />}

        {/* Input + Add */}
        <div className="flex gap-1">
          <input
            type="text"
            value={inputValue}
            onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={`Add ${category} word...`}
            className="flex-1 text-xs px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={addWord}
            disabled={!inputValue.trim()}
            className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
