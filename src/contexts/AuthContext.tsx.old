import React, { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { auditService } from '../services/database';
import { User as SupabaseUser } from '@supabase/supabase-js';

// Define types based on your existing schema
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user'; // Updated to match your schema
  departmentId?: string;
  phone?: string;
  position?: string;
  is_active?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired?: boolean; factors?: Array<{ id: string; type: string }>; }>;
  verifyMfa: (params: { factorId: string; code: string; challengeId?: string }) => Promise<void>;
  startEnrollTotp: () => Promise<{ factorId: string; qrCode?: string; otpauthUrl?: string }>; 
  verifyEnrollTotp: (params: { factorId: string; code: string }) => Promise<void>;
  disableTotp: (factorId: string) => Promise<void>;
  listMfaFactors: () => Promise<Array<{ id: string; type: string; friendlyName?: string; status?: string }>>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During hot-reload or out-of-tree usage, expose a non-crashing fallback
    const noop = async () => { /* no-op */ };
    const noopLogin = async () => ({}) as any;
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: noopLogin,
      verifyMfa: noop as any,
      startEnrollTotp: async () => ({ factorId: '' }),
      verifyEnrollTotp: noop as any,
      disableTotp: noop as any,
      listMfaFactors: async () => [],
      logout: noop,
      forgotPassword: noop as any,
      resetPassword: noop as any
    } as AuthContextType;
  }
  return context;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert Supabase user to our User type
  const convertSupabaseUser = async (supabaseUser: SupabaseUser): Promise<User | null> => {
    try {
      // Get user profile from our users table
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', supabaseUser.email)
        .single();

      if (error || !profile) {
        return null;
      }

      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as 'admin' | 'manager' | 'user',
        departmentId: profile.department_id || undefined,
        phone: profile.phone || undefined,
        position: profile.position || undefined,
        is_active: profile.is_active
      };
    } catch (error) {
      return null;
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          const userData = await convertSupabaseUser(session.user);
          setUser(userData);
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            const userData = await convertSupabaseUser(session.user);
            setUser(userData);
          }
          setIsLoading(false);
          return;
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await convertSupabaseUser(session.user);
          setUser(userData);
          try { await auditService.write({ user_id: session.user.id, action: 'auth.sign_in', entity_type: 'auth', entity_id: session.user.id, details: { email: session.user.email } }); } catch {}
        } else if (event === 'SIGNED_OUT') {
          try { await auditService.write({ user_id: user?.id || null, action: 'auth.sign_out', entity_type: 'auth', entity_id: user?.id || null, details: {} }); } catch {}
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
      // MFA check: if session missing but factors present, require MFA
      if (!data.session && (data?.user?.factors?.length || 0) > 0) {
        const factors = (data.user as any).factors?.map((f: any) => ({ id: f.id, type: f.factor_type })) || [];
        return { mfaRequired: true, factors };
      }

      if (data.user) {
        const userData = await convertSupabaseUser(data.user);
        if (!userData) {
          throw new Error('User profile not found in database');
        }
        setUser(userData);
        try { await auditService.write({ user_id: data.user.id, action: 'auth.sign_in', entity_type: 'auth', entity_id: data.user.id, details: { email: data.user.email } }); } catch {}
      }
      return {};
    } catch (error: any) {
      try { await auditService.write({ user_id: null, action: 'auth.sign_in_failed', entity_type: 'auth', entity_id: null, details: { email, error: String(error?.message || error) } }); } catch {}
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Verify MFA after password sign-in
  const verifyMfa = async ({ factorId, code, challengeId }: { factorId: string; code: string; challengeId?: string }) => {
    // Create a challenge if not provided
    const challengeRes = challengeId ? { data: { id: challengeId } } : await supabase.auth.mfa.challenge({ factorId });
    const challenge = (challengeRes as any).data;
    if (!challenge || !challenge.id) throw new Error('MFA challenge could not be created');
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) {
      try { await auditService.write({ user_id: null, action: 'auth.mfa_verify_failed', entity_type: 'auth', entity_id: null, details: { factorId, error: String(error.message || error) } }); } catch {}
      throw error as any;
    }
    // After verification, set user from current session
    const { data: sessionRes } = await supabase.auth.getSession();
    const supaUser = sessionRes.session?.user;
    if (supaUser) {
      const userData = await convertSupabaseUser(supaUser);
      setUser(userData);
      try { await auditService.write({ user_id: supaUser.id, action: 'auth.mfa_verify', entity_type: 'auth', entity_id: supaUser.id, details: { factorId } }); } catch {}
    }
  };

  // Begin TOTP enrollment and return QR data
  const startEnrollTotp = async (): Promise<{ factorId: string; qrCode?: string; otpauthUrl?: string }> => {
    const friendlyName = `Authenticator ${new Date().toISOString()}`;
    const { data, error } = await (supabase.auth as any).mfa.enroll({ factorType: 'totp', friendlyName });
    if (error) throw error;
    // Support different SDK shapes
    const factorId = (data?.id) || (data?.factor?.id);
    const qr = data?.totp?.qr_code || data?.qr_code;
    const uri = data?.totp?.uri || data?.totp?.otpauth_url || data?.otpauth_url;
    if (!factorId) throw new Error('Could not retrieve TOTP factor ID from enrollment');
    try { await auditService.write({ user_id: null, action: 'auth.mfa_enroll_start', entity_type: 'auth', entity_id: factorId, details: {} }); } catch {}
    return { factorId, qrCode: qr, otpauthUrl: uri };
  };

  // Verify enrollment with a code to activate the factor
  const verifyEnrollTotp = async ({ factorId, code }: { factorId: string; code: string }) => {
    const cleaned = (code || '').replace(/\s+/g, '');
    const mfa = (supabase.auth as any).mfa;
    if (typeof mfa.verifyFactor === 'function') {
      const { error } = await mfa.verifyFactor({ factorId, code: cleaned });
      if (error) throw error;
    } else {
      const { error } = await mfa.verify({ factorId, code: cleaned });
      if (error) throw error;
    }
    try { await auditService.write({ user_id: null, action: 'auth.mfa_enroll_verify', entity_type: 'auth', entity_id: factorId, details: {} }); } catch {}
  };

  // Disable a TOTP factor
  const disableTotp = async (factorId: string) => {
    const { error } = await (supabase.auth as any).mfa.unenroll({ factorId });
    if (error) throw error;
    try { await auditService.write({ user_id: null, action: 'auth.mfa_disable', entity_type: 'auth', entity_id: factorId, details: {} }); } catch {}
  };

  // List existing MFA factors (TOTP/WebAuthn)
  const listMfaFactors = async (): Promise<Array<{ id: string; type: string; friendlyName?: string; status?: string }>> => {
    const { data, error } = await (supabase.auth as any).mfa.listFactors();
    if (error) throw error;
    const factors = (data?.factors || data?.all || []) as any[];
    return factors.map((f: any) => ({ id: f.id, type: f.factor_type || f.type, friendlyName: f.friendly_name || f.friendlyName, status: f.status }));
  };

  // Logout function
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
      }
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  // Forgot password function
  const forgotPassword = async (email: string) => {
    try {
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        throw error;
      }
      try { await auditService.write({ user_id: null, action: 'auth.password_reset_requested', entity_type: 'auth', entity_id: null, details: { email } }); } catch {}
      
    } catch (error) {
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (password: string) => {
    try {
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }
      try { await auditService.write({ user_id: user?.id || null, action: 'auth.password_reset', entity_type: 'auth', entity_id: user?.id || null, details: {} }); } catch {}
      
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    verifyMfa,
    startEnrollTotp,
    verifyEnrollTotp,
    disableTotp,
    listMfaFactors,
    logout,
    forgotPassword,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};