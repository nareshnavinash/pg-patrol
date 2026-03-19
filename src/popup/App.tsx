import Header from './components/Header';
import StatsCard from './components/StatsCard';
import Settings from './components/Settings';
import CustomWords from './components/CustomWords';
import SiteManager from './components/SiteManager';
import RevealToggle from './components/RevealToggle';
import PerspectiveSetup from './components/PerspectiveSetup';
import CollapsibleSection from './components/CollapsibleSection';
import Onboarding from './components/Onboarding';
import ActivityLog from './components/ActivityLog';
import Toast from './components/Toast';
import { useStorage } from './hooks/useStorage';
import { useCurrentTab } from './hooks/useCurrentTab';
import { useToast } from './hooks/useToast';
import type { Sensitivity } from '../shared/types';

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

  if (!settings.hasSeenOnboarding) {
    return (
      <Onboarding
        onComplete={(sensitivity: Sensitivity) => {
          updateSettings({ hasSeenOnboarding: true, sensitivity });
        }}
      />
    );
  }

  const customWordsCount = settings.customBlockedWords.length + settings.customSafeWords.length;

  return (
    <div className="w-[360px] min-h-[480px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 relative">
      <Header
        enabled={settings.enabled}
        onToggle={(enabled) => {
          updateSettings({ enabled });
          showToast(enabled ? 'PG Patrol enabled' : 'PG Patrol disabled');
        }}
        textFilterEnabled={settings.textFilterEnabled}
        imageFilterEnabled={settings.imageFilterEnabled}
        positiveModeEnabled={settings.positiveModeEnabled}
        mlClassifierEnabled={settings.mlClassifierEnabled}
      />

      <StatsCard
        totalWordsReplaced={settings.stats.totalWordsReplaced}
        totalImagesReplaced={settings.stats.totalImagesReplaced}
      />

      <ActivityLog />

      <RevealToggle />

      <SiteManager
        hostname={hostname}
        settings={settings}
        onUpdate={updateSettings}
        showToast={showToast}
      />

      <CollapsibleSection title="Settings" defaultOpen={true}>
        <Settings settings={settings} onUpdate={updateSettings} showToast={showToast} />
      </CollapsibleSection>

      <CollapsibleSection title="Custom Words" defaultOpen={false} badge={customWordsCount}>
        <CustomWords settings={settings} onUpdate={updateSettings} showToast={showToast} />
      </CollapsibleSection>

      <PerspectiveSetup
        apiKey={settings.perspectiveApiKey}
        onSave={(perspectiveApiKey) => {
          updateSettings({ perspectiveApiKey });
          showToast(perspectiveApiKey ? 'API key saved' : 'API key removed');
        }}
      />

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
        <p className="text-xs text-gray-400">PG Patrol v{chrome.runtime.getManifest().version}</p>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
