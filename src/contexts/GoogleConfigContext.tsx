import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { settingsAPI } from '../services/apiService';

interface GoogleConfig {
  enabled: boolean;
  clientId: string;
  allowedDomain: string;
}

const GoogleConfigContext = createContext<GoogleConfig>({ enabled: false, clientId: '', allowedDomain: '' });

export const GoogleConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<GoogleConfig>({ enabled: false, clientId: '', allowedDomain: '' });

  useEffect(() => {
    settingsAPI.getGoogleOAuthConfig()
      .then(setConfig)
      .catch(() => { /* non-fatal — leave defaults */ });
  }, []);

  return (
    <GoogleConfigContext.Provider value={config}>
      {children}
    </GoogleConfigContext.Provider>
  );
};

export const useGoogleConfig = () => useContext(GoogleConfigContext);
