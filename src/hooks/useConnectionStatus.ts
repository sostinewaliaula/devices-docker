import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const { error } = await supabase
        .from('departments')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        setIsConnected(false);
      } else {
        setIsConnected(true);
      }
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    isChecking,
    checkConnection
  };
};
