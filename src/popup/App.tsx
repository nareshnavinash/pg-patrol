import Header from './components/Header';
import StatsCard from './components/StatsCard';
import Settings from './components/Settings';
import CustomWords from './components/CustomWords';
import SiteManager from './components/SiteManager';
import RevealToggle from './components/RevealToggle';
import PerspectiveSetup from './components/PerspectiveSetup';
import Toast from './components/Toast';
import { useStorage } from './hooks/useStorage';
import { useCurrentTab } from './hooks/useCurrentTab';
import { useToast } from './hooks/useToast';

export default function App() {
  const { settings, loading, updateSettings } = useStorage();
  const { hostname } = useCurrentTab();
  const { toast, showToast } = useToast();

  if (loading) {
    return (
      <div className="w-[360px] min-h-[480px] bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-[360px] min-h-[480px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 relative">
      <Header
        enabled={settings.enabled}
        onToggle={(enabled) => {
          updateSettings({ enabled });
          showToast(enabled ? 'PG Patrol enabled' : 'PG Patrol disabled');
        }}
      />

      <StatsCard
        totalWordsReplaced={settings.stats.totalWordsReplaced}
        totalImagesReplaced={settings.stats.totalImagesReplaced}
      />

      <Settings settings={settings} onUpdate={updateSettings} showToast={showToast} />

      <CustomWords settings={settings} onUpdate={updateSettings} showToast={showToast} />

      <SiteManager
        hostname={hostname}
        settings={settings}
        onUpdate={updateSettings}
        showToast={showToast}
      />

      <PerspectiveSetup
        apiKey={settings.perspectiveApiKey}
        onSave={(perspectiveApiKey) => {
          updateSettings({ perspectiveApiKey });
          showToast(perspectiveApiKey ? 'API key saved' : 'API key removed');
        }}
      />

      <RevealToggle />

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-center space-y-2">
        <p className="text-xs text-gray-400">PG Patrol v1.0.0</p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Rate on Chrome Web Store"
            className="text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 1l2.09 4.26L15 6.27l-3.5 3.42L12.18 15 8 12.77 3.82 15l.68-5.31L1 6.27l4.91-.71z" />
            </svg>
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report a bug"
            className="text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 1a7 7 0 00-2.21 13.64c.35.06.48-.15.48-.33v-1.3c-1.96.43-2.37-.84-2.37-.84-.32-.81-.78-1.03-.78-1.03-.64-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.63 1.07 1.64.76 2.04.58.06-.46.24-.76.44-.93-1.56-.18-3.2-.78-3.2-3.47 0-.77.27-1.4.72-1.89-.07-.18-.31-.9.07-1.87 0 0 .59-.19 1.93.72a6.7 6.7 0 013.5 0c1.34-.91 1.93-.72 1.93-.72.38.97.14 1.69.07 1.87.45.49.72 1.12.72 1.89 0 2.7-1.64 3.29-3.21 3.46.25.22.48.65.48 1.3v1.93c0 .19.13.4.49.33A7 7 0 008 1z" />
            </svg>
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Help and documentation"
            className="text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a1 1 0 110-2 1 1 0 010 2zm1.14-4.7c-.52.36-.64.55-.64 1.02V10H7.5v-.18c0-.87.28-1.3.97-1.78.56-.39.78-.64.78-1.09 0-.54-.45-.95-1.14-.95-.7 0-1.2.44-1.28 1.1H5.83C5.93 5.9 6.8 5 8.11 5c1.34 0 2.22.83 2.22 1.95 0 .78-.37 1.3-1.19 1.85z" />
            </svg>
          </a>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
