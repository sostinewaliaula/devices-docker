import express from 'express';
import db from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import mfaService from '../services/mfaService.js';

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
});

/**
 * @route   GET /api/admin/mfa-status
 * @desc    Get MFA status for all users
 * @access  Admin
 */
router.get('/mfa-status', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.mfa_enabled,
        u.mfa_enrolled_at,
        u.last_mfa_verification,
        u.last_login,
        d.name as department_name,
        COALESCE(factor_counts.factors_count, 0) as factors_count
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN (
        SELECT 
          user_id, 
          COUNT(*) as factors_count 
        FROM user_mfa_factors 
        WHERE is_active = 1 
        GROUP BY user_id
      ) factor_counts ON u.id = factor_counts.user_id
      WHERE u.is_active = 1
      ORDER BY u.name ASC
    `);

    const users = rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      department_name: row.department_name,
      mfa_enabled: Boolean(row.mfa_enabled),
      mfa_enrolled_at: row.mfa_enrolled_at,
      last_mfa_verification: row.last_mfa_verification,
      last_login: row.last_login,
      factors_count: row.factors_count
    }));

    res.json({ users });
  } catch (error) {
    console.error('Error fetching MFA status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/admin/mfa-factors/:userId
 * @desc    Get MFA factors for a specific user
 * @access  Admin
 */
router.get('/mfa-factors/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const [userRows] = await db.execute(
      'SELECT id, name, email FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's MFA factors
    const factors = await mfaService.getFactors(userId);

    res.json({ factors });
  } catch (error) {
    console.error('Error fetching user MFA factors:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   POST /api/admin/disable-user-mfa/:userId
 * @desc    Disable MFA for a specific user
 * @access  Admin
 */
router.post('/disable-user-mfa/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const [userRows] = await db.execute(
      'SELECT id, name, email, mfa_enabled FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userRows[0];

    if (!user.mfa_enabled) {
      return res.status(400).json({ message: 'User MFA is already disabled' });
    }

    // Disable all MFA factors for the user
    await db.execute(
      'DELETE FROM user_mfa_factors WHERE user_id = ?',
      [userId]
    );

    // Disable MFA for the user
    await db.execute(
      'UPDATE users SET mfa_enabled = 0, mfa_enrolled_at = NULL, last_mfa_verification = NULL WHERE id = ?',
      [userId]
    );

    // Clear recovery codes
    await db.execute(
      'DELETE FROM user_recovery_codes WHERE user_id = ?',
      [userId]
    );

    res.json({ 
      message: 'User MFA disabled successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error disabling user MFA:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/admin/disable-factor/:userId/:factorId
 * @desc    Disable a specific MFA factor for a user
 * @access  Admin
 */
router.delete('/disable-factor/:userId/:factorId', async (req, res) => {
  try {
    const { userId, factorId } = req.params;

    // Verify user exists
    const [userRows] = await db.execute(
      'SELECT id, name, email FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify factor exists
    const [factorRows] = await db.execute(
      'SELECT id FROM user_mfa_factors WHERE user_id = ? AND factor_id = ?',
      [userId, factorId]
    );

    if (factorRows.length === 0) {
      return res.status(404).json({ message: 'MFA factor not found' });
    }

    // Disable the specific factor
    await mfaService.disableFactor(userId, factorId);

    res.json({ 
      message: 'MFA factor disabled successfully',
      factorId: factorId
    });
  } catch (error) {
    console.error('Error disabling MFA factor:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   POST /api/admin/generate-recovery-codes/:userId
 * @desc    Generate new recovery codes for a user
 * @access  Admin
 */
router.post('/generate-recovery-codes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { count = 10 } = req.body;

    // Verify user exists
    const [userRows] = await db.execute(
      'SELECT id, name, email FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate recovery codes
    const recoveryCodes = await mfaService.generateRecoveryCodes(userId, count);

    res.json({ 
      message: 'Recovery codes generated successfully',
      recoveryCodes: recoveryCodes,
      user: {
        id: userRows[0].id,
        name: userRows[0].name,
        email: userRows[0].email
      }
    });
  } catch (error) {
    console.error('Error generating recovery codes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/admin/mfa-stats
 * @desc    Get MFA statistics for admin dashboard
 * @access  Admin
 */
router.get('/mfa-stats', async (req, res) => {
  try {
    const [statsRows] = await db.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN mfa_enabled = 1 THEN 1 ELSE 0 END) as mfa_enabled_users,
        SUM(CASE WHEN mfa_enabled = 0 THEN 1 ELSE 0 END) as mfa_disabled_users,
        COUNT(DISTINCT umf.user_id) as users_with_factors,
        COUNT(umf.id) as total_factors
      FROM users u
      LEFT JOIN user_mfa_factors umf ON u.id = umf.user_id AND umf.is_active = 1
      WHERE u.is_active = 1
    `);

    const [recentEnrollments] = await db.execute(`
      SELECT COUNT(*) as recent_enrollments
      FROM users 
      WHERE mfa_enrolled_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND is_active = 1
    `);

    const [recentVerifications] = await db.execute(`
      SELECT COUNT(*) as recent_verifications
      FROM users 
      WHERE last_mfa_verification >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND is_active = 1
    `);

    const stats = {
      total_users: statsRows[0].total_users,
      mfa_enabled_users: statsRows[0].mfa_enabled_users,
      mfa_disabled_users: statsRows[0].mfa_disabled_users,
      users_with_factors: statsRows[0].users_with_factors,
      total_factors: statsRows[0].total_factors,
      recent_enrollments: recentEnrollments[0].recent_enrollments,
      recent_verifications: recentVerifications[0].recent_verifications,
      mfa_adoption_rate: statsRows[0].total_users > 0 
        ? ((statsRows[0].mfa_enabled_users / statsRows[0].total_users) * 100).toFixed(1)
        : 0
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching MFA stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
