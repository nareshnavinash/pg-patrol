import { useState, useEffect } from 'preact/hooks';

export function useCurrentTab() {
  const [hostname, setHostname] = useState('');
  const [tabId, setTabId] = useState<number | undefined>();

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        try {
          const url = new URL(tab.url);
          setHostname(url.hostname);
        } catch {
          // Invalid URL
        }
      }
      if (tab?.id) {
        setTabId(tab.id);
      }
    }).catch(() => {
      // Tabs API might not be available
    });
  }, []);

  return { hostname, tabId };
}
