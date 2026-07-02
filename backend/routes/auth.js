import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import emailService from '../services/emailService.js';
import notificationService from '../services/notificationService.js';
import auditLogger from '../utils/auditLogger.js';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();

// Register new user (self-registration - always creates 'user' role)
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 }),
  body('position').trim().notEmpty().withMessage('Position is required'),
  body('department_id').notEmpty().withMessage('Department is required'),
  body('role').optional() // Ignore role if provided - self-registration always creates 'user'
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Force role to 'user' for self-registration (prevent privilege escalation)
    const { email, password, name, department_id, phone, position } = req.body;
    const role = 'user'; // Always set to 'user' for self-registration

    // Validate position is provided
    if (!position || position.trim() === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Position is required'
      });
    }

    // Validate department_id is provided
    if (!department_id || department_id.trim() === '') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Department is required'
      });
    }

    // Check if user already exists
    const existingUser = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.success && existingUser.data.length > 0) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate UUID for the user (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const userId = randomUUID();

    // Create user
    const result = await executeQuery(
      `INSERT INTO users (id, email, password_hash, name, role, department_id, phone, position) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, name, role, department_id || null, phone || null, position || null]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Registration failed',
        message: 'Could not create user account'
      });
    }

    // Get the created user using the generated UUID
    const userResult = await executeQuery(
      'SELECT id, email, name, role, department_id, phone, position, created_at FROM users WHERE id = ?',
      [userId]
    );

    const user = userResult.data[0];

    // Log user registration
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logAuth(user.id, 'REGISTER', {
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      position: user.position
    }, ipAddress, userAgent);

    // Send welcome notification and email to the new user
    try {
      console.log('Sending welcome notification for user:', user.email);
      const notificationResult = await notificationService.notifyUserCreation(
        user.id,
        user.email,
        user.name,
        password // Send the original password as temporary password
      );
      console.log('Notification result:', notificationResult);
    } catch (notificationError) {
      console.error('Failed to send welcome notification:', notificationError);
      // Don't fail the registration if notification fails
    }

    // Notify all admins about the new user registration
    try {
      console.log('Notifying admins about new user registration:', user.email);

      // Get all active admins
      const adminsResult = await executeQuery(
        `SELECT id, name, email, email_notifications FROM users 
         WHERE role = 'admin' AND is_active = TRUE`,
        []
      );

      if (adminsResult.success && adminsResult.data.length > 0) {
        // Get department name if available
        let departmentName = 'Not assigned';
        if (department_id) {
          const deptResult = await executeQuery(
            'SELECT name FROM departments WHERE id = ?',
            [department_id]
          );
          if (deptResult.success && deptResult.data.length > 0) {
            departmentName = deptResult.data[0].name;
          }
        }

        // Create notification for each admin
        const adminNotifications = adminsResult.data.map(async (admin) => {
          const title = 'New User Registration';
          const message = `A new user "${user.name}" (${user.email}) has registered. Position: ${position || 'N/A'}, Department: ${departmentName}`;

          // Create in-app notification
          await notificationService.createNotification(
            admin.id,
            null, // No asset request ID
            'info',
            title,
            message
          );

          // Send email notification if enabled
          if (admin.email && admin.email_notifications) {
            try {
              const emailSubject = 'New User Registration - Action Required';
              const emailHtml = notificationService.generateNewUserRegistrationEmailHtml(
                admin.name,
                user.name,
                user.email,
                position || 'N/A',
                departmentName,
                phone || 'N/A'
              );
              const emailText = notificationService.generateNewUserRegistrationEmailText(
                admin.name,
                user.name,
                user.email,
                position || 'N/A',
                departmentName,
                phone || 'N/A'
              );

              await notificationService.sendEmailNotification(
                admin.email,
                emailSubject,
                emailHtml,
                emailText
              );
            } catch (emailError) {
              console.error(`Failed to send email to admin ${admin.email}:`, emailError);
              // Continue with other admins even if one email fails
            }
          }
        });

        await Promise.all(adminNotifications);
        console.log(`Notified ${adminsResult.data.length} admin(s) about new user registration`);
      }
    } catch (adminNotificationError) {
      console.error('Failed to notify admins about new user registration:', adminNotificationError);
      // Don't fail the registration if admin notification fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        phone: user.phone,
        position: user.position,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Get user from database including MFA status
    const userResult = await executeQuery(
      'SELECT id, email, password_hash, name, role, department_id, phone, position, is_active, mfa_enabled, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    const user = userResult.data[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    await executeQuery(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Log login
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logAuth(user.id, 'LOGIN', {
      email: user.email,
      role: user.role,
      mfa_enabled: user.mfa_enabled
    }, ipAddress, userAgent);

    // Check MFA policies and requirements
    let policyEnforcement = { requiresMfa: false, compliance: { isCompliant: true } };
    try {
      const mfaPolicyService = (await import('../services/mfaPolicyService.js')).default;
      policyEnforcement = await mfaPolicyService.enforcePolicies(user.id, user.role);
    } catch (error) {
      console.error('Error checking MFA policies:', error);
      // Continue with login even if policy check fails
    }

    // Check if MFA is enabled or required by policy
    if (user.mfa_enabled || policyEnforcement.requiresMfa) {
      // Check if user has any MFA factors
      const mfaService = (await import('../services/mfaService.js')).default;
      const userFactors = await mfaService.getUserFactors(user.id);
      const activeFactors = userFactors.filter(f => f.status === 'verified');

      // If user has no MFA factors but policy requires MFA, allow temporary bypass for setup
      if (policyEnforcement.requiresMfa && activeFactors.length === 0) {
        console.log('🔧 User has no MFA factors but policy requires MFA - generating temp token');
        console.log('🔧 User ID:', user.id, 'Email:', user.email);

        // Generate a temporary token that allows MFA setup
        const tempToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            department_id: user.department_id,
            tempMfaSetup: true,
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('🔧 Generated temp token:', tempToken.substring(0, 50) + '...');

        return res.json({
          message: 'MFA setup required - temporary access granted',
          requiresMfaSetup: true,
          tempToken: tempToken,
          userId: user.id,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            department_id: user.department_id,
            phone: user.phone,
            position: user.position,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        });
      }

      // Return MFA required response
      return res.json({
        message: policyEnforcement.requiresMfa ? 'MFA verification required by policy' : 'MFA verification required',
        requiresMfa: true,
        userId: user.id,
        policyEnforcement: policyEnforcement,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department_id: user.department_id,
          phone: user.phone,
          position: user.position,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });
    }

    // Generate JWT token for users without MFA
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        phone: user.phone,
        position: user.position,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An unexpected error occurred'
    });
  }
});

// MFA verification during login
router.post('/verify-mfa-login', [
  body('userId').notEmpty(),
  body('factorId').notEmpty(),
  body('token').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId, factorId, token } = req.body;

    // Import MFA service
    const mfaService = (await import('../services/mfaService.js')).default;

    let isValid = false;

    // Check if this is a recovery code verification
    if (factorId === 'recovery-code') {
      isValid = await mfaService.verifyRecoveryCode(userId, token);
    } else {
      // Verify MFA token
      isValid = await mfaService.verifyToken(userId, factorId, token);
    }

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid MFA token',
        message: 'The verification code is incorrect or expired'
      });
    }

    // Get user details
    const userResult = await executeQuery(
      'SELECT id, email, name, role, department_id, phone, position, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found'
      });
    }

    const user = userResult.data[0];

    // Generate JWT token
    const token_jwt = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'MFA verification successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        phone: user.phone,
        position: user.position,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token: token_jwt
    });
  } catch (error) {
    console.error('MFA login verification error:', error);
    res.status(500).json({
      error: 'MFA verification failed',
      message: 'An unexpected error occurred during MFA verification'
    });
  }
});

// Get MFA factors for login verification (no auth required)
router.post('/mfa-factors-for-login', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID is required',
        message: 'User ID must be provided'
      });
    }

    // Import MFA service
    const mfaService = (await import('../services/mfaService.js')).default;

    // Get user's MFA factors
    const factors = await mfaService.getUserFactors(userId);
    const activeFactors = factors.filter(f => f.status === 'verified');

    res.json({
      factors: activeFactors
    });
  } catch (error) {
    console.error('Error getting MFA factors for login:', error);
    res.status(500).json({
      error: 'Failed to get MFA factors',
      message: 'An unexpected error occurred'
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.last_login, u.created_at, u.updated_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = userResult.data[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        phone: user.phone,
        position: user.position,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: 'An unexpected error occurred'
    });
  }
});

// Update current user profile
router.put('/profile', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('position').optional().trim(),
  body('department_id').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, phone, position, department_id, email } = req.body;
    const userId = req.user.id;

    // If email is being changed, check if it's already taken
    if (email) {
      const existingUser = await executeQuery(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (existingUser.success && existingUser.data.length > 0) {
        return res.status(400).json({
          error: 'Email already in use',
          message: 'This email address is already associated with another account'
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (position !== undefined) {
      updates.push('position = ?');
      params.push(position);
    }
    if (department_id !== undefined) {
      updates.push('department_id = ?');
      params.push(department_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    const result = await executeQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Profile update failed',
        message: 'Could not update profile'
      });
    }

    // Get updated user profile
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.last_login, u.created_at, u.updated_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [userId]
    );

    const updatedUser = userResult.data[0];

    // Log profile update
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logAuth(userId, 'PROFILE_UPDATE', {
      email: updatedUser.email,
      name: updatedUser.name,
      changes: req.body
    }, ipAddress, userAgent);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        department_id: updatedUser.department_id,
        department_name: updatedUser.department_name,
        phone: updatedUser.phone,
        position: updatedUser.position,
        is_active: updatedUser.is_active,
        last_login: updatedUser.last_login,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Change password
router.put('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const userResult = await executeQuery(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = userResult.data[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid current password',
        message: 'The current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateResult = await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    if (!updateResult.success) {
      return res.status(500).json({
        error: 'Password update failed',
        message: 'Could not update password'
      });
    }

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Password update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Forgot password - request password reset
router.post('/forgot-password', [
  body('email').isEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email } = req.body;

    // Check if user exists
    const userResult = await executeQuery(
      'SELECT id, email, name FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (!userResult.success || userResult.data.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const user = userResult.data[0];

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Generate a unique token for the reset
    const crypto = await import('crypto');
    const uniqueToken = crypto.randomBytes(32).toString('hex');

    // Store reset code in database
    await executeQuery(
      'INSERT INTO password_reset_tokens (user_id, token, code, expires_at, used) VALUES (?, ?, ?, ?, ?)',
      [user.id, uniqueToken, resetCode, expiresAt, false]
    );

    // Send password reset email with code
    const emailResult = await emailService.sendPasswordResetEmail(email, user.name, resetCode);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Don't fail the request if email fails, just log it
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Password reset request failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Reset password - validate token and update password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { token, password } = req.body;

    // Find valid reset token
    const tokenResult = await executeQuery(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email, u.name 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [token]
    );

    if (!tokenResult.success || tokenResult.data.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const resetData = tokenResult.data[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update user password
    const updateResult = await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, resetData.user_id]
    );

    if (!updateResult.success) {
      return res.status(500).json({
        error: 'Password update failed',
        message: 'Could not update password. Please try again.'
      });
    }

    // Mark token as used
    await executeQuery(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
      [resetData.id]
    );

    res.json({
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Validate reset token (for frontend to check if token is valid)
router.get('/validate-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        message: 'Reset token is required'
      });
    }

    const tokenResult = await executeQuery(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email, u.name 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = ? AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [token]
    );

    if (!tokenResult.success || tokenResult.data.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset link is invalid or has expired. Please request a new one.'
      });
    }

    const resetData = tokenResult.data[0];

    res.json({
      valid: true,
      user: {
        email: resetData.email,
        name: resetData.name
      }
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({
      error: 'Token validation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Verify reset code
router.post('/verify-reset-code', [
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, code } = req.body;

    // Find valid reset code
    const codeResult = await executeQuery(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email, u.name 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE u.email = ? AND prt.code = ? AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [email, code]
    );

    if (!codeResult.success || codeResult.data.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired code',
        message: 'The reset code is invalid or has expired. Please request a new one.'
      });
    }

    const resetData = codeResult.data[0];

    res.json({
      message: 'Code verified successfully',
      user: {
        email: resetData.email,
        name: resetData.name
      }
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      error: 'Code verification failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Change password with code
router.post('/change-password-with-code', [
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, code, password } = req.body;

    // Find valid reset code
    const codeResult = await executeQuery(
      `SELECT prt.id, prt.user_id, prt.expires_at, u.email, u.name 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE u.email = ? AND prt.code = ? AND prt.used = FALSE AND prt.expires_at > NOW()`,
      [email, code]
    );

    if (!codeResult.success || codeResult.data.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired code',
        message: 'The reset code is invalid or has expired. Please request a new one.'
      });
    }

    const resetData = codeResult.data[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update user password
    const updateResult = await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, resetData.user_id]
    );

    if (!updateResult.success) {
      return res.status(500).json({
        error: 'Password update failed',
        message: 'Could not update password. Please try again.'
      });
    }

    // Mark code as used
    await executeQuery(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
      [resetData.id]
    );

    res.json({
      message: 'Password has been changed successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Change password with code error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Test email service (for development/testing)
router.get('/test-email', async (req, res) => {
  try {
    const testResult = await emailService.testConnection();

    if (testResult.success) {
      res.json({
        message: 'Email service is working correctly',
        smtp_host: process.env.SMTP_HOST,
        smtp_port: process.env.SMTP_PORT,
        smtp_user: process.env.SMTP_USER
      });
    } else {
      res.status(500).json({
        error: 'Email service test failed',
        details: testResult.error
      });
    }
  } catch (error) {
    console.error('Email service test error:', error);
    res.status(500).json({
      error: 'Email service test failed',
      message: error.message
    });
  }
});

// Get user notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    console.log('Getting notifications for user:', req.user.id, 'limit:', limit, 'offset:', offset);
    const result = await notificationService.getUserNotifications(req.user.id, parseInt(limit), parseInt(offset));

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to fetch notifications',
        message: result.error
      });
    }

    res.json({
      notifications: result.notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      message: 'An unexpected error occurred'
    });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await notificationService.markAsRead(id, req.user.id);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to mark notification as read',
        message: result.error
      });
    }

    res.json({
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: 'An unexpected error occurred'
    });
  }
});

// Get unread notification count
router.get('/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to get unread count',
        message: result.error
      });
    }

    res.json({
      count: result.count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      message: 'An unexpected error occurred'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  // Log logout
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;
  await auditLogger.logAuth(req.user.id, 'LOGOUT', {
    email: req.user.email,
    role: req.user.role
  }, ipAddress, userAgent);

  res.json({
    message: 'Logout successful'
  });
});

// ─── Google OAuth (token-based, no server-side sessions) ─────────────────────
// Flow: frontend opens popup → google → redirects to /auth/google/callback with
// ?code=… → backend exchanges code for tokens → verifies id_token → creates/links
// user → returns JWT + profile_complete flag.

// Helper: fetch a single Google OAuth setting from the DB (falls back to .env)
async function getGoogleSetting(key) {
  const result = await executeQuery(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [key]
  );
  return result.data?.[0]?.setting_value ?? null;
}

// POST /auth/google/token  — frontend sends the Google credential (id_token) from
// the Google Identity Services one-tap / popup flow, we verify it server-side.
router.post('/google/token', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    // Load config from DB (admin-configurable), fall back to env
    const clientId = (await getGoogleSetting('google_client_id')) || process.env.GOOGLE_CLIENT_ID;
    const enabled = (await getGoogleSetting('google_oauth_enabled')) ?? 'false';
    const allowedDomain = (await getGoogleSetting('google_allowed_domain')) || process.env.GOOGLE_ALLOWED_DOMAIN || '';

    if (!clientId || enabled === 'false') {
      return res.status(503).json({ error: 'Google sign-in is not configured or disabled.' });
    }

    // Verify the ID token
    const googleClient = new OAuth2Client(clientId);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Domain restriction — allowedDomain may be comma-separated (e.g. "acme.com,corp.acme.com")
    if (allowedDomain) {
      const allowedList = allowedDomain.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (allowedList.length > 0 && !allowedList.includes(emailDomain)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: 'Your Google account is not authorised to sign in to this application.'
        });
      }
    }

    const { randomUUID } = await import('crypto');
    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Check if a user with this google_id exists
    let userResult = await executeQuery(
      'SELECT id, email, name, role, department_id, phone, position, is_active, profile_complete, avatar_url, mfa_enabled FROM users WHERE google_id = ?',
      [googleId]
    );

    let user = userResult.data?.[0];

    if (!user) {
      // Check if an account exists with this email (link it)
      const byEmail = await executeQuery(
        'SELECT id, email, name, role, department_id, phone, position, is_active, profile_complete, avatar_url, mfa_enabled FROM users WHERE email = ?',
        [email]
      );

      if (byEmail.data?.length > 0) {
        // Link google_id to existing account
        user = byEmail.data[0];
        await executeQuery(
          'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), updated_at = NOW() WHERE id = ?',
          [googleId, picture || null, user.id]
        );
        user.profile_complete = 1; // existing accounts are complete
      } else {
        // Create new account — profile is incomplete (needs position + department)
        const newUserId = randomUUID();
        await executeQuery(
          `INSERT INTO users (id, email, name, google_id, avatar_url, role, profile_complete, is_active)
           VALUES (?, ?, ?, ?, ?, 'user', 0, 1)`,
          [newUserId, email, name, googleId, picture || null]
        );

        const newUser = await executeQuery(
          'SELECT id, email, name, role, department_id, phone, position, is_active, profile_complete, avatar_url, mfa_enabled FROM users WHERE id = ?',
          [newUserId]
        );
        user = newUser.data[0];

        await auditLogger.logAuth(user.id, 'REGISTER_GOOGLE', { email, name }, ipAddress, userAgent);

        // Notify admins
        try {
          const adminsResult = await executeQuery(
            `SELECT id, name, email, email_notifications FROM users WHERE role = 'admin' AND is_active = TRUE`
          );
          if (adminsResult.success && adminsResult.data.length > 0) {
            for (const admin of adminsResult.data) {
              await notificationService.createNotification(
                admin.id, null, 'info',
                'New Google Sign-Up',
                `"${name}" (${email}) signed up via Google. Profile completion pending.`
              );
            }
          }
        } catch (_) { /* non-fatal */ }
      }
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account deactivated', message: 'Your account has been deactivated.' });
    }

    // Update last login
    await executeQuery('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await auditLogger.logAuth(user.id, 'LOGIN_GOOGLE', { email: user.email }, ipAddress, userAgent);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Google login successful',
      token,
      profile_complete: !!user.profile_complete,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        phone: user.phone,
        position: user.position,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        profile_complete: !!user.profile_complete,
      }
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Google authentication failed', message: error.message });
  }
});

// POST /auth/google/complete-profile — called after Google sign-up to fill in
// position and department (and optional phone) for a new Google-only user.
router.post('/google/complete-profile', authenticateToken, [
  body('position').trim().notEmpty().withMessage('Position is required'),
  body('department_id').notEmpty().withMessage('Department is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { position, department_id, phone } = req.body;
    const userId = req.user.userId;

    const result = await executeQuery(
      'UPDATE users SET position = ?, department_id = ?, phone = COALESCE(?, phone), profile_complete = 1, updated_at = NOW() WHERE id = ?',
      [position, department_id, phone || null, userId]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    const updated = await executeQuery(
      'SELECT id, email, name, role, department_id, phone, position, is_active, profile_complete, avatar_url FROM users WHERE id = ?',
      [userId]
    );

    const user = updated.data[0];

    res.json({
      message: 'Profile completed successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        phone: user.phone,
        position: user.position,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        profile_complete: true,
      }
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

export default router;

