import api from './apiService';

export interface MFAFactor {
  id: string;
  type: string;
  friendlyName: string;
  status: 'verified' | 'pending';
  createdAt: string;
}

export interface MFAEnrollmentData {
  factorId: string;
  qrCode: string;
  otpauthUrl: string;
  secret: string;
}

export interface MFARecoveryCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

export interface MFAStatus {
  mfaEnabled: boolean;
  factorCount: number;
  activeFactors: number;
  lastVerification?: string;
}

export const mfaService = {
  /**
   * Start MFA enrollment process
   * @param friendlyName - Friendly name for the authenticator
   * @returns Promise<MFAEnrollmentData>
   */
  async startEnrollment(friendlyName?: string): Promise<MFAEnrollmentData> {
    const response = await api.post('/mfa/enroll', {
      friendlyName: friendlyName || 'Authenticator'
    });
    return response.data;
  },

  /**
   * Verify MFA token and activate factor
   * @param factorId - Factor ID from enrollment
   * @param token - TOTP token from authenticator app
   * @returns Promise<{recoveryCodes: string[]}>
   */
  async verifyEnrollment(factorId: string, token: string): Promise<{recoveryCodes: string[]}> {
    const response = await api.post('/mfa/verify', {
      factorId,
      token
    });
    return response.data;
  },

  /**
   * Verify MFA token during login
   * @param userId - User ID
   * @param factorId - Factor ID
   * @param token - TOTP token
   * @returns Promise<{verified: boolean}>
   */
  async verifyLogin(userId: string, factorId: string, token: string): Promise<{verified: boolean}> {
    const response = await api.post('/mfa/verify-login', {
      userId,
      factorId,
      token
    });
    return response.data;
  },

  /**
   * Get user's MFA factors
   * @returns Promise<{factors: MFAFactor[], mfaEnabled: boolean}>
   */
  async getFactors(): Promise<{factors: MFAFactor[], mfaEnabled: boolean}> {
    const response = await api.get('/mfa/factors');
    return response.data;
  },

  /**
   * Disable a MFA factor
   * @param factorId - Factor ID to disable
   * @returns Promise<{message: string}>
   */
  async disableFactor(factorId: string): Promise<{message: string}> {
    const response = await api.delete(`/mfa/factors/${factorId}`);
    return response.data;
  },

  /**
   * Generate new recovery codes
   * @param count - Number of codes to generate (default: 10)
   * @returns Promise<{recoveryCodes: string[]}>
   */
  async generateRecoveryCodes(count: number = 10): Promise<{recoveryCodes: string[]}> {
    const response = await api.post('/mfa/recovery-codes', { count });
    return response.data;
  },

  /**
   * Verify recovery code
   * @param userId - User ID
   * @param code - Recovery code
   * @returns Promise<{verified: boolean}>
   */
  async verifyRecoveryCode(userId: string, code: string): Promise<{verified: boolean}> {
    const response = await api.post('/mfa/verify-recovery', {
      userId,
      code
    });
    return response.data;
  },

  /**
   * Get MFA status
   * @returns Promise<MFAStatus>
   */
  async getStatus(): Promise<MFAStatus> {
    const response = await api.get('/mfa/status');
    return response.data;
  },

  /**
   * Check if user has MFA enabled (convenience method)
   * @returns Promise<boolean>
   */
  async isEnabled(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.mfaEnabled;
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return false;
    }
  }
};

export default mfaService;
