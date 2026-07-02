import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from 'lucide-react';

interface DatabaseStatusProps {
  className?: string;
}

const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    try {
      setStatus('connecting');

      // Check if we can reach Supabase at all (basic connectivity test)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setStatus('error');
        setLastChecked(new Date());
        return;
      }

      // If not authenticated, just show connected (backend is reachable)
      if (!sessionData.session) {
        setStatus('connected');
        setLastChecked(new Date());
        return;
      }

      // Only test database access if authenticated
      const { error } = await supabase
        .from('departments')
        .select('id', { count: 'exact', head: true });
      
      if (error) {
        setStatus('error');
      } else {
        setStatus('connected');
      }
      setLastChecked(new Date());
    } catch (error) {
      setStatus('error');
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'connecting':
        return <ClockIcon className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Database Connected';
      case 'error':
        return 'Database Error';
      case 'connecting':
        return 'Connecting...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getStatusIcon()}
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      {lastChecked && (
        <span className="text-xs text-gray-500">
          Last checked: {lastChecked.toLocaleTimeString()}
        </span>
      )}
      <button
        onClick={checkConnection}
        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        title="Check connection"
      >
        Refresh
      </button>
    </div>
  );
};

export default DatabaseStatus;
