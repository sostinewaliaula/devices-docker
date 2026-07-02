import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import mfaService from '../services/mfaService.js';

const router = express.Router();

// All MFA routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/mfa/enroll
 * @desc    Start MFA enrollment process
 * @access  Private
 */
router.post('/enroll', async (req, res) => {
  try {
    const { friendlyName } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Check if user already has MFA enabled
    const isEnabled = await mfaService.isMFAEnabled(userId);
    if (isEnabled) {
      return res.status(400).json({
        message: 'MFA is already enabled for this user',
        code: 'MFA_ALREADY_ENABLED'
      });
    }

    // Generate new MFA secret
    const result = await mfaService.generateSecret(
      userId,
      userEmail,
      friendlyName || 'Authenticator'
    );

    res.json({
      message: 'MFA enrollment started',
      factorId: result.factorId,
      qrCode: result.qrCode,
      otpauthUrl: result.otpauthUrl,
      secret: result.secret // Include for manual entry
    });
  } catch (error) {
    console.error('Error starting MFA enrollment:', error);
    res.status(500).json({
      message: 'Failed to start MFA enrollment',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mfa/verify
 * @desc    Verify MFA token and activate factor
 * @access  Private
 */
router.post('/verify', async (req, res) => {
  try {
    const { factorId, token } = req.body;
    const userId = req.user.id;

    console.log('🔍 MFA Verification Request:', { userId, factorId, token: token ? 'provided' : 'missing' });

    if (!factorId || !token) {
      console.log('❌ Missing parameters:', { factorId: !!factorId, token: !!token });
      return res.status(400).json({
        message: 'Factor ID and token are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Activate the factor
    console.log('🔄 Attempting to activate factor...');
    await mfaService.activateFactor(userId, factorId, token);
    console.log('✅ Factor activated successfully');

    // Get recovery codes for display
    const recoveryCodes = await mfaService.generateRecoveryCodes(userId);

    res.json({
      message: 'MFA successfully enabled',
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    console.error('Error verifying MFA token:', error);
    res.status(400).json({
      message: 'Failed to verify MFA token',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mfa/verify-login
 * @desc    Verify MFA token during login
 * @access  Public (no auth required)
 */
router.post('/verify-login', async (req, res) => {
  try {
    const { userId, factorId, token } = req.body;

    if (!userId || !factorId || !token) {
      return res.status(400).json({
        message: 'User ID, Factor ID, and token are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Verify the token
    const isValid = await mfaService.verifyToken(userId, factorId, token);

    if (!isValid) {
      return res.status(400).json({
        message: 'Invalid MFA token',
        code: 'INVALID_TOKEN'
      });
    }

    res.json({
      message: 'MFA verification successful',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying MFA during login:', error);
    res.status(400).json({
      message: 'Failed to verify MFA token',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mfa/factors
 * @desc    Get user's MFA factors
 * @access  Private
 */
router.get('/factors', async (req, res) => {
  try {
    const userId = req.user.id;
    const factors = await mfaService.getUserFactors(userId);

    res.json({
      factors: factors,
      mfaEnabled: await mfaService.isMFAEnabled(userId)
    });
  } catch (error) {
    console.error('Error getting MFA factors:', error);
    res.status(500).json({
      message: 'Failed to get MFA factors',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/mfa/factors/:factorId
 * @desc    Disable a MFA factor
 * @access  Private
 */
router.delete('/factors/:factorId', async (req, res) => {
  try {
    const { factorId } = req.params;
    const userId = req.user.id;

    await mfaService.disableFactor(userId, factorId);

    res.json({
      message: 'MFA factor disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling MFA factor:', error);
    res.status(500).json({
      message: 'Failed to disable MFA factor',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mfa/recovery-codes
 * @desc    Generate new recovery codes
 * @access  Private
 */
router.post('/recovery-codes', async (req, res) => {
  try {
    const userId = req.user.id;
    const { count = 10 } = req.body;

    const recoveryCodes = await mfaService.generateRecoveryCodes(userId, count);

    res.json({
      message: 'Recovery codes generated successfully',
      recoveryCodes: recoveryCodes
    });
  } catch (error) {
    console.error('Error generating recovery codes:', error);
    res.status(500).json({
      message: 'Failed to generate recovery codes',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/mfa/verify-recovery
 * @desc    Verify recovery code
 * @access  Public (for login recovery)
 */
router.post('/verify-recovery', async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        message: 'User ID and recovery code are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    const isValid = await mfaService.verifyRecoveryCode(userId, code);

    if (!isValid) {
      return res.status(400).json({
        message: 'Invalid recovery code',
        code: 'INVALID_RECOVERY_CODE'
      });
    }

    res.json({
      message: 'Recovery code verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    res.status(500).json({
      message: 'Failed to verify recovery code',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/mfa/status
 * @desc    Get user's MFA status
 * @access  Private
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const mfaEnabled = await mfaService.isMFAEnabled(userId);
    const factors = await mfaService.getUserFactors(userId);

    res.json({
      mfaEnabled: mfaEnabled,
      factorCount: factors.length,
      activeFactors: factors.filter(f => f.status === 'verified').length,
      lastVerification: req.user.last_mfa_verification
    });
  } catch (error) {
    console.error('Error getting MFA status:', error);
    res.status(500).json({
      message: 'Failed to get MFA status',
      error: error.message
    });
  }
});

export default router;
