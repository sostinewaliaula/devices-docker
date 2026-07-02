import { useState, useEffect, useCallback } from 'react'
import { supabase, checkConnection, reconnectSupabase } from '../lib/supabase'

export const useSupabase = () => {
  const [isConnected, setIsConnected] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Check connection status
  const checkConnectionStatus = useCallback(async () => {
    try {
      const connected = await checkConnection()
      setIsConnected(connected)
      if (connected) {
        setLastError(null)
      }
      return connected
    } catch (error) {
      setIsConnected(false)
      return false
    }
  }, [])

  // Attempt to reconnect
  const reconnect = useCallback(async () => {
    if (isConnecting) return false
    
    setIsConnecting(true)
    try {
      const success = await reconnectSupabase()
      setIsConnected(success)
      if (success) {
        setLastError(null)
      }
      return success
    } catch (error) {
      setLastError('Failed to reconnect to database')
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [isConnecting])

  // Enhanced query function with automatic reconnection
  const query = useCallback(async <T>(
    queryFn: () => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> => {
    try {
      // First attempt
      const result = await queryFn()
      
      if (result.error) {
        // Check if it's a connection error
        if (result.error.message?.includes('connection') || 
            result.error.message?.includes('timeout') ||
            result.error.code === 'PGRST301') {
          
          const reconnected = await reconnect()
          
          if (reconnected) {
            // Retry the query
            return await queryFn()
          }
        }
      }
      
      return result
    } catch (error) {
      return { data: null, error }
    }
  }, [reconnect])

  // Monitor connection status
  useEffect(() => {
    const checkInterval = setInterval(checkConnectionStatus, 30000) // Check every 30 seconds
    
    // Check on mount
    checkConnectionStatus()
    
    return () => clearInterval(checkInterval)
  }, [checkConnectionStatus])

  // Listen for Supabase connection changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkConnectionStatus()
      }
    })

    return () => subscription.unsubscribe()
  }, [checkConnectionStatus])

  return {
    supabase,
    isConnected,
    isConnecting,
    lastError,
    checkConnection: checkConnectionStatus,
    reconnect,
    query
  }
}
