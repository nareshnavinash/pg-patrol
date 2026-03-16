import type { PGPatrolSettings } from '../../shared/types';
import Chip from './Chip';

interface SiteManagerProps {
  hostname: string;
  settings: PGPatrolSettings;
  onUpdate: (partial: Partial<PGPatrolSettings>) => void;
  showToast?: (message: string) => void;
}

export default function SiteManager({ hostname, settings, onUpdate, showToast }: SiteManagerProps) {
  const isWhitelisted = settings.whitelistedSites.includes(hostname);

  const toggleWhitelist = () => {
    const whitelistedSites = isWhitelisted
      ? settings.whitelistedSites.filter((s) => s !== hostname)
      : [...settings.whitelistedSites, hostname];
    onUpdate({ whitelistedSites });
    showToast?.(isWhitelisted ? `Removed ${hostname} from whitelist` : `Whitelisted ${hostname}`);
  };

  const removeSite = (site: string) => {
    onUpdate({
      whitelistedSites: settings.whitelistedSites.filter((s) => s !== site),
    });
    showToast?.(`Removed ${site} from whitelist`);
  };

  return (
    <div className="mt-3 space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Current Site
      </h2>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
        {hostname ? (
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center text-xs px-3 py-1 rounded-full font-medium ${
                isWhitelisted
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {hostname}
            </span>
            <button
              onClick={toggleWhitelist}
              className={`
                text-xs px-2.5 py-1 rounded-md transition-colors
                ${
                  isWhitelisted
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                }
              `}
            >
              {isWhitelisted ? 'Whitelisted' : 'Whitelist'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">No active site</p>
        )}

        {settings.whitelistedSites.length > 0 && (
          <div>
            <h3 className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Whitelisted Sites</h3>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {settings.whitelistedSites.map((site) => (
                <Chip key={site} label={site} color="amber" onRemove={() => removeSite(site)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
