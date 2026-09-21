import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { settingsAPI } from '../services/apiService';

interface GoogleConfig {
  enabled: boolean;
  clientId: string;
  allowedDomain: string;
  /** True once the config request has settled (success or failure). */
  loaded: boolean;
}

const GoogleConfigContext = createContext<GoogleConfig>({ enabled: false, clientId: '', allowedDomain: '', loaded: false });

export const GoogleConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<GoogleConfig>({ enabled: false, clientId: '', allowedDomain: '', loaded: false });

  useEffect(() => {
    settingsAPI.getGoogleOAuthConfig()
      .then(cfg => setConfig({ ...cfg, loaded: true }))
      .catch(() => setConfig(prev => ({ ...prev, loaded: true }))); // non-fatal — keep defaults
  }, []);

  return (
    <GoogleConfigContext.Provider value={config}>
      {children}
    </GoogleConfigContext.Provider>
  );
};

export const useGoogleConfig = () => useContext(GoogleConfigContext);
