import React from 'react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { WifiOffIcon } from 'lucide-react';

interface ConnectionStatusProps {
  showOnlyWhenOffline?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showOnlyWhenOffline = false, 
  className = '' 
}) => {
  const { isConnected, isChecking } = useConnectionStatus();

  // Don't show anything if we're connected and only want to show when offline
  if (showOnlyWhenOffline && isConnected) {
    return null;
  }

  // Don't show anything if we're connected
  if (isConnected) {
    return null;
  }

  return (
    <div className={`p-4 bg-red-50 border border-red-200 rounded-xl ${className}`}>
      <div className="flex items-center space-x-3">
        <WifiOffIcon className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">
            Database Connection Lost
          </p>
          <p className="text-xs text-red-600">
            Unable to connect to the database. Some features may be unavailable.
          </p>
        </div>
        {isChecking ? (
          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
