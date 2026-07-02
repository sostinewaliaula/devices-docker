import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { authAPI, User } from '../services/apiService';
import mfaService, { MFAFactor, MFAEnrollmentData } from '../services/mfaService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ requiresMfa?: boolean; userId?: string; user?: User }>;
  verifyMfaLogin: (userId: string, factorId: string, token: string) => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    department_id?: string;
    phone?: string;
    position?: string;
  }) => Promise<void>;
  googleLogin: (credential: string) => Promise<{ profile_complete: boolean }>;
  completeGoogleProfile: (data: { position: string; department_id: string; phone?: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  validateResetToken: (token: string) => Promise<{ valid: boolean; user?: { email: string; name: string } }>;
  verifyResetCode: (email: string, code: string) => Promise<{ message: string; user: { email: string; name: string } }>;
  changePasswordWithCode: (email: string, code: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  // MFA functions
  startEnrollTotp: (friendlyName?: string) => Promise<MFAEnrollmentData>;
  verifyEnrollTotp: (factorId: string, token: string) => Promise<{ recoveryCodes: string[] }>;
  disableTotp: (factorId: string) => Promise<void>;
  listMfaFactors: () => Promise<MFAFactor[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  // Check if user is authenticated
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  // Debug user state changes
  useEffect(() => {
    // console.log('👤 User state changed:', { user, isAuthenticated, loading });
  }, [user, isAuthenticated, loading]);

  // Initialize auth state
  useEffect(() => {
    if (initializing) return; // Prevent multiple simultaneous initializations

    const initAuth = async () => {
      try {
        setInitializing(true);
        const token = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
          // console.log('🔍 Initializing auth with token and stored user');
          try {
            // First try to verify token by getting user profile
            // console.log('🔍 Trying to get profile...');
            const response = await authAPI.getProfile();
            // console.log('✅ Profile loaded successfully:', response.user);
            // console.log('🔍 Setting user state...');
            setUser(response.user);
            // console.log('✅ User state set, isAuthenticated will be:', !!response.user);
          } catch (profileError) {
            // console.log('❌ Profile failed, checking for temp token:', profileError.message);
            // If profile fails, check if it's a temporary MFA setup token
            try {
              const decoded = JSON.parse(atob(token.split('.')[1]));
              // console.log('🔍 Decoded token:', decoded);
              if (decoded.tempMfaSetup) {
                // This is a temporary MFA setup token, use stored user data
                const userData = JSON.parse(storedUser);
                // console.log('✅ Using temporary MFA setup token with user:', userData);
                setUser(userData);
              } else {
                // console.log('❌ Not a temp token, re-throwing error');
                throw profileError; // Re-throw if not a temp token
              }
            } catch (tokenError) {
              // console.log('❌ Token decode failed:', tokenError.message);
              // Token is invalid, clear everything
              throw profileError;
            }
          }
        } else {
          // console.log('🔍 No token or stored user found');
        }
      } catch (error) {
        // console.error('❌ Auth initialization error:', error);
        // Clear invalid token
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        // console.log('🔍 Auth initialization complete, loading:', false);
        setLoading(false);
        setInitializing(false);
      }
    };

    initAuth();
  }, []); // Empty dependency array - only run once on mount

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<{ requiresMfa?: boolean; userId?: string; user?: User }> => {
    try {
      setLoading(true);
      const response = await authAPI.login(email, password);

      // Check if MFA is required
      if (response.requiresMfa) {
        return {
          requiresMfa: true,
          userId: response.userId!,
          user: response.user
        };
      }

      // Check if MFA setup is required
      if (response.requiresMfaSetup) {
        // console.log('🔧 MFA Setup Required - Storing temporary token');
        // console.log('🔧 Temp Token:', response.tempToken);
        // console.log('🔧 User Data:', response.user);

        // Store temporary token and redirect to settings
        localStorage.setItem('authToken', response.tempToken);
        localStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);

        // console.log('🔧 Stored in localStorage, redirecting to MFA setup...');
        // Redirect to MFA setup page
        window.location.href = '/mfa-setup';
        return { requiresMfa: false };
      }

      // Store token and user data for normal login
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);

      return { requiresMfa: false };
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // MFA login verification function
  const verifyMfaLogin = useCallback(async (userId: string, factorId: string, token: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await authAPI.verifyMfaLogin(userId, factorId, token);

      // Store token and user data
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (error: any) {
      console.error('MFA verification error:', error);
      throw new Error(error.response?.data?.error || 'MFA verification failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Register function
  const register = useCallback(async (userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    department_id?: string;
    phone?: string;
    position?: string;
  }): Promise<void> => {
    try {
      setLoading(true);
      const response = await authAPI.register(userData);

      // Store token and user data
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Google OAuth login
  const googleLogin = useCallback(async (credential: string): Promise<{ profile_complete: boolean }> => {
    try {
      setLoading(true);
      const response = await authAPI.googleLogin(credential);
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      return { profile_complete: response.profile_complete };
    } catch (error: any) {
      console.error('Google login error:', error);
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Google login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete profile for new Google-only accounts
  const completeGoogleProfile = useCallback(async (data: { position: string; department_id: string; phone?: string }): Promise<void> => {
    try {
      const response = await authAPI.completeGoogleProfile(data);
      const updatedUser = response.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error: any) {
      console.error('Complete profile error:', error);
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Failed to complete profile');
    }
  }, []);

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  // Update profile function
  const updateProfile = useCallback(async (userData: Partial<User>): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');

      // Call the API to update profile
      const response = await authAPI.updateProfile({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        position: userData.position,
        department_id: userData.department_id
      });

      // Update local state and storage with data from server
      const updatedUser = response.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error: any) {
      console.error('Profile update error:', error);
      throw new Error(error.response?.data?.error || 'Profile update failed');
    }
  }, [user]);

  // Change password function
  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await authAPI.changePassword(currentPassword, newPassword);
    } catch (error: any) {
      console.error('Password change error:', error);
      throw new Error(error.response?.data?.error || 'Password change failed');
    }
  }, []);

  // Forgot password function
  const forgotPassword = useCallback(async (email: string): Promise<void> => {
    try {
      await authAPI.forgotPassword(email);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(error.response?.data?.error || 'Password reset request failed');
    }
  }, []);

  // Reset password function
  const resetPassword = useCallback(async (token: string, password: string): Promise<void> => {
    try {
      await authAPI.resetPassword(token, password);
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(error.response?.data?.error || 'Password reset failed');
    }
  }, []);

  // Validate reset token function
  const validateResetToken = useCallback(async (token: string): Promise<{ valid: boolean; user?: { email: string; name: string } }> => {
    try {
      return await authAPI.validateResetToken(token);
    } catch (error: any) {
      console.error('Validate reset token error:', error);
      return { valid: false };
    }
  }, []);

  // Verify reset code function
  const verifyResetCode = useCallback(async (email: string, code: string): Promise<{ message: string; user: { email: string; name: string } }> => {
    try {
      return await authAPI.verifyResetCode(email, code);
    } catch (error: any) {
      console.error('Verify reset code error:', error);
      throw new Error(error.response?.data?.error || 'Code verification failed');
    }
  }, []);

  // Change password with code function
  const changePasswordWithCode = useCallback(async (email: string, code: string, password: string): Promise<void> => {
    try {
      await authAPI.changePasswordWithCode(email, code, password);
    } catch (error: any) {
      console.error('Change password with code error:', error);
      throw new Error(error.response?.data?.error || 'Password change failed');
    }
  }, []);

  // MFA functions
  const startEnrollTotp = useCallback(async (friendlyName?: string): Promise<MFAEnrollmentData> => {
    try {
      return await mfaService.startEnrollment(friendlyName);
    } catch (error: any) {
      console.error('Start MFA enrollment error:', error);
      throw new Error(error.response?.data?.message || 'Failed to start MFA enrollment');
    }
  }, []);

  const verifyEnrollTotp = useCallback(async (factorId: string, token: string): Promise<{ recoveryCodes: string[] }> => {
    try {
      return await mfaService.verifyEnrollment(factorId, token);
    } catch (error: any) {
      console.error('Verify MFA enrollment error:', error);
      throw new Error(error.response?.data?.message || 'Failed to verify MFA enrollment');
    }
  }, []);

  const disableTotp = useCallback(async (factorId: string): Promise<void> => {
    try {
      await mfaService.disableFactor(factorId);
    } catch (error: any) {
      console.error('Disable MFA factor error:', error);
      throw new Error(error.response?.data?.message || 'Failed to disable MFA factor');
    }
  }, []);

  const listMfaFactors = useCallback(async (): Promise<MFAFactor[]> => {
    try {
      const result = await mfaService.getFactors();
      return result.factors;
    } catch (error: any) {
      console.error('List MFA factors error:', error);
      throw new Error(error.response?.data?.message || 'Failed to list MFA factors');
    }
  }, []);

  const value: AuthContextType = useMemo(() => ({
    user,
    loading,
    isLoading: loading,
    login,
    verifyMfaLogin,
    register,
    googleLogin,
    completeGoogleProfile,
    logout,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    validateResetToken,
    verifyResetCode,
    changePasswordWithCode,
    isAuthenticated,
    isAdmin,
    isManager,
    // MFA functions
    startEnrollTotp,
    verifyEnrollTotp,
    disableTotp,
    listMfaFactors,
  }), [user, loading, login, verifyMfaLogin, register, googleLogin, completeGoogleProfile, logout, updateProfile, changePassword, forgotPassword, resetPassword, validateResetToken, verifyResetCode, changePasswordWithCode, isAuthenticated, isAdmin, isManager, startEnrollTotp, verifyEnrollTotp, disableTotp, listMfaFactors]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

