import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import mfaPolicyService from '../services/mfaPolicyService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/mfa-policies
 * @desc    Get all MFA policies
 * @access  Admin
 */
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const policies = await mfaPolicyService.getPolicies();
    res.json({ policies });
  } catch (error) {
    console.error('Error fetching MFA policies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/mfa-policies/:id
 * @desc    Get a specific MFA policy
 * @access  Admin
 */
router.get('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const policy = await mfaPolicyService.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json({ policy });
  } catch (error) {
    console.error('Error fetching MFA policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   POST /api/mfa-policies
 * @desc    Create a new MFA policy
 * @access  Admin
 */
router.post('/', [
  body('name').notEmpty().withMessage('Policy name is required'),
  body('description').optional(),
  body('enforcement_level').isIn(['optional', 'recommended', 'required']).withMessage('Invalid enforcement level'),
  body('target_roles').isArray().withMessage('Target roles must be an array'),
  body('exempt_roles').optional().isArray(),
  body('grace_period_days').isInt({ min: 0 }).withMessage('Grace period must be a non-negative integer'),
  body('enabled').optional().isBoolean()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const policy = await mfaPolicyService.createPolicy(req.body, req.user.id);
    res.status(201).json({ policy });
  } catch (error) {
    console.error('Error creating MFA policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/mfa-policies/:id
 * @desc    Update an MFA policy
 * @access  Admin
 */
router.put('/:id', [
  body('name').optional().notEmpty(),
  body('description').optional(),
  body('enforcement_level').optional().isIn(['optional', 'recommended', 'required']),
  body('target_roles').optional().isArray(),
  body('exempt_roles').optional().isArray(),
  body('grace_period_days').optional().isInt({ min: 0 }),
  body('enabled').optional().isBoolean()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const policy = await mfaPolicyService.updatePolicy(req.params.id, req.body, req.user.id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json({ policy });
  } catch (error) {
    console.error('Error updating MFA policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/mfa-policies/:id
 * @desc    Delete an MFA policy
 * @access  Admin
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const success = await mfaPolicyService.deletePolicy(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting MFA policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/mfa-policies/user/:userId/compliance
 * @desc    Get user's MFA compliance status
 * @access  Admin or User (own data)
 */
router.get('/user/:userId/compliance', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get user's role
    const db = (await import('../config/database.js')).default;
    const [userRows] = await db.execute(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userRole = userRows[0].role;
    const compliance = await mfaPolicyService.checkUserCompliance(userId, userRole);
    
    res.json({ compliance });
  } catch (error) {
    console.error('Error checking user compliance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/mfa-policies/user/:userId/violations
 * @desc    Get user's MFA policy violations
 * @access  Admin or User (own data)
 */
router.get('/user/:userId/violations', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const violations = await mfaPolicyService.getUserViolations(userId);
    res.json({ violations });
  } catch (error) {
    console.error('Error fetching user violations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   POST /api/mfa-policies/violations/:violationId/resolve
 * @desc    Resolve a policy violation
 * @access  Admin
 */
router.post('/violations/:violationId/resolve', [
  body('notes').optional().isString()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { violationId } = req.params;
    const { notes } = req.body;

    await mfaPolicyService.resolveViolation(violationId, notes);
    res.json({ message: 'Violation resolved successfully' });
  } catch (error) {
    console.error('Error resolving violation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/mfa-policies/stats/compliance
 * @desc    Get MFA compliance statistics
 * @access  Admin
 */
router.get('/stats/compliance', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await mfaPolicyService.getComplianceStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching compliance stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/mfa-policies/my-compliance
 * @desc    Get current user's MFA compliance status
 * @access  Authenticated
 */
router.get('/my-compliance', async (req, res) => {
  try {
    const compliance = await mfaPolicyService.checkUserCompliance(req.user.id, req.user.role);
    res.json({ compliance });
  } catch (error) {
    console.error('Error checking my compliance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
