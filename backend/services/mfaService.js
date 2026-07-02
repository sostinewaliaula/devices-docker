import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import db from '../config/database.js';

class MFAService {
  /**
   * Generate a new TOTP secret for a user
   * @param {string} userId - User ID
   * @param {string} userEmail - User email for QR code label
   * @param {string} friendlyName - Friendly name for the factor
   * @returns {Promise<{factorId: string, secret: string, qrCode: string, otpauthUrl: string}>}
   */
  async generateSecret(userId, userEmail, friendlyName = 'Authenticator') {
    try {
      // Generate a unique factor ID
      const factorId = crypto.randomUUID();
      
      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `Assets Management (${userEmail})`,
        issuer: 'Assets Management System',
        length: 32
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);
      
      // Store the factor in database
      await db.execute(
        `INSERT INTO user_mfa_factors (id, user_id, factor_id, factor_type, friendly_name, secret, is_active) 
         VALUES (UUID(), ?, ?, 'totp', ?, ?, 0)`,
        [userId, factorId, friendlyName, secret.base32]
      );

      return {
        factorId,
        secret: secret.base32,
        qrCode,
        otpauthUrl: secret.otpauth_url
      };
    } catch (error) {
      console.error('Error generating MFA secret:', error);
      throw new Error('Failed to generate MFA secret');
    }
  }

  /**
   * Verify a TOTP token
   * @param {string} userId - User ID
   * @param {string} factorId - Factor ID
   * @param {string} token - TOTP token to verify
   * @returns {Promise<boolean>}
   */
  async verifyToken(userId, factorId, token) {
    try {
      console.log('🔍 Verifying token for:', { userId, factorId, token: token ? 'provided' : 'missing' });
      
      // Get the secret for this factor (during enrollment, factor might not be active yet)
      const [rows] = await db.execute(
        'SELECT secret FROM user_mfa_factors WHERE user_id = ? AND factor_id = ?',
        [userId, factorId]
      );

      console.log('📊 Database query result:', { rowCount: rows.length });

      if (rows.length === 0) {
        console.log('❌ No factor found in database');
        throw new Error('MFA factor not found or inactive');
      }

      const secret = rows[0].secret;
      console.log('🔑 Secret found, length:', secret.length);
      
      // Verify the token
      const cleanedToken = token.replace(/\s+/g, '');
      console.log('🔢 Verifying token:', { original: token, cleaned: cleanedToken });
      
      const verified = speakeasy.totp.verify({
        secret,
        token: cleanedToken,
        window: 2, // Allow 2 time windows for clock drift
        encoding: 'base32'
      });

      console.log('✅ Token verification result:', verified);

      if (verified) {
        // Update last verification time
        await db.execute(
          'UPDATE users SET last_mfa_verification = CURRENT_TIMESTAMP WHERE id = ?',
          [userId]
        );
      }

      return verified;
    } catch (error) {
      console.error('Error verifying MFA token:', error);
      return false;
    }
  }

  /**
   * Activate a MFA factor after successful verification
   * @param {string} userId - User ID
   * @param {string} factorId - Factor ID
   * @param {string} token - TOTP token for verification
   * @returns {Promise<boolean>}
   */
  async activateFactor(userId, factorId, token) {
    try {
      console.log('🔄 Activating factor:', { userId, factorId });
      
      // First verify the token
      const isValid = await this.verifyToken(userId, factorId, token);
      console.log('🔍 Token verification result:', isValid);
      
      if (!isValid) {
        console.log('❌ Token verification failed');
        throw new Error('Invalid verification token');
      }

      // Activate the factor
      await db.execute(
        'UPDATE user_mfa_factors SET is_active = 1 WHERE user_id = ? AND factor_id = ?',
        [userId, factorId]
      );

      // Enable MFA for the user
      await db.execute(
        'UPDATE users SET mfa_enabled = 1, mfa_enrolled_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );

      // Generate recovery codes
      await this.generateRecoveryCodes(userId);

      return true;
    } catch (error) {
      console.error('Error activating MFA factor:', error);
      throw error;
    }
  }

  /**
   * Generate recovery codes for a user
   * @param {string} userId - User ID
   * @param {number} count - Number of codes to generate (default: 10)
   * @returns {Promise<string[]>}
   */
  async generateRecoveryCodes(userId, count = 10) {
    try {
      console.log('🔧 Generating recovery codes for user:', userId, 'count:', count);
      
      // Delete existing unused codes
      await db.execute(
        'DELETE FROM user_recovery_codes WHERE user_id = ? AND is_used = 0',
        [userId]
      );

      const codes = [];
      const codeHashes = [];

      // Generate codes (8-character alphanumeric codes)
      for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(6).toString('base64')
          .replace(/[+/=]/g, '') // Remove special characters
          .substring(0, 8)
          .toUpperCase();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        
        codes.push(code);
        codeHashes.push([userId, codeHash]);
      }

      console.log('🔧 Generated codes:', codes);
      console.log('🔧 Code hashes count:', codeHashes.length);

      // Insert hashed codes into database
      if (codeHashes.length > 0) {
        const placeholders = codeHashes.map(() => '(?, ?, 0, NULL, CURRENT_TIMESTAMP)').join(', ');
        const values = codeHashes.flat();
        console.log('🔧 Inserting with placeholders:', placeholders);
        console.log('🔧 Values:', values);
        
        await db.execute(
          `INSERT INTO user_recovery_codes (user_id, code_hash, is_used, used_at, created_at) VALUES ${placeholders}`,
          values
        );
        console.log('✅ Recovery codes inserted successfully');
      }

      return codes;
    } catch (error) {
      console.error('❌ Error generating recovery codes:', error);
      throw new Error('Failed to generate recovery codes');
    }
  }

  /**
   * Verify a recovery code
   * @param {string} userId - User ID
   * @param {string} code - Recovery code to verify
   * @returns {Promise<boolean>}
   */
  async verifyRecoveryCode(userId, code) {
    try {
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      
      const [rows] = await db.execute(
        'SELECT id FROM user_recovery_codes WHERE user_id = ? AND code_hash = ? AND is_used = 0',
        [userId, codeHash]
      );

      if (rows.length === 0) {
        return false;
      }

      // Mark code as used
      await db.execute(
        'UPDATE user_recovery_codes SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rows[0].id]
      );

      return true;
    } catch (error) {
      console.error('Error verifying recovery code:', error);
      return false;
    }
  }

  /**
   * Get user's MFA factors
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserFactors(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT id, factor_id, factor_type, friendly_name, is_active, created_at FROM user_mfa_factors WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      return rows.map(row => ({
        id: row.factor_id,
        type: row.factor_type,
        friendlyName: row.friendly_name,
        status: row.is_active ? 'verified' : 'pending',
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error getting user factors:', error);
      throw new Error('Failed to get MFA factors');
    }
  }

  /**
   * Disable a MFA factor
   * @param {string} userId - User ID
   * @param {string} factorId - Factor ID
   * @returns {Promise<boolean>}
   */
  async disableFactor(userId, factorId) {
    try {
      // Disable the factor
      await db.execute(
        'UPDATE user_mfa_factors SET is_active = 0 WHERE user_id = ? AND factor_id = ?',
        [userId, factorId]
      );

      // Check if user has any active factors
      const [activeFactors] = await db.execute(
        'SELECT COUNT(*) as count FROM user_mfa_factors WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      // If no active factors, disable MFA for user
      if (activeFactors[0].count === 0) {
        await db.execute(
          'UPDATE users SET mfa_enabled = 0 WHERE id = ?',
          [userId]
        );
      }

      return true;
    } catch (error) {
      console.error('Error disabling MFA factor:', error);
      throw new Error('Failed to disable MFA factor');
    }
  }

  /**
   * Check if user has MFA enabled
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isMFAEnabled(userId) {
    try {
      const [rows] = await db.execute(
        'SELECT mfa_enabled FROM users WHERE id = ?',
        [userId]
      );

      return rows.length > 0 && rows[0].mfa_enabled === 1;
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return false;
    }
  }

}

export default new MFAService();
