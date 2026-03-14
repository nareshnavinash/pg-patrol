import { useState } from 'preact/hooks';
import { testApiKey } from '../../shared/perspective-api';

interface PerspectiveSetupProps {
  apiKey: string;
  onSave: (apiKey: string) => void;
}

export default function PerspectiveSetup({ apiKey, onSave }: PerspectiveSetupProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputKey, setInputKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!inputKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    const valid = await testApiKey(inputKey.trim());
    setTestResult(valid ? 'success' : 'error');
    setTesting(false);
  };

  const handleSave = () => {
    onSave(inputKey.trim());
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>
          &#9656;
        </span>
        Advanced: Enhanced Detection (Perspective API)
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optionally use Google&apos;s Perspective API for ML-based toxicity detection.
            This requires a free API key.
          </p>

          <div className="flex gap-2">
            <input
              type="password"
              value={inputKey}
              onInput={(e) => {
                setInputKey((e.target as HTMLInputElement).value);
                setTestResult(null);
              }}
              placeholder="Enter API key"
              className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !inputKey.trim()}
              className="text-xs px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Key'}
            </button>
            <button
              onClick={handleSave}
              disabled={!inputKey.trim()}
              className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>

          {testResult === 'success' && (
            <p className="text-xs text-green-600 dark:text-green-400">
              API key is valid!
            </p>
          )}
          {testResult === 'error' && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Invalid API key or connection error.
            </p>
          )}

          {apiKey && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Enhanced detection is active.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
