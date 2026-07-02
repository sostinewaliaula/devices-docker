import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import notificationService from '../services/notificationService.js';
import { requireAdmin, requireManager, authenticateToken } from '../middleware/auth.js';
import auditLogger from '../utils/auditLogger.js';
import { sanitizePagination } from '../utils/pagination.js';

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
  try {
    const { page: pageParam = 1, limit: limitParam = 1000, search = '', role = '', roles = '', department_id = '', notInDepartment = '' } = req.query;
    
    // Debug logging
    console.log('Users API called with params:', { page: pageParam, limit: limitParam, search, role, department_id, notInDepartment });
    console.log('notInDepartment type:', typeof notInDepartment);
    console.log('notInDepartment value:', JSON.stringify(notInDepartment));
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }

    if (roles) {
      const roleList = roles.split(',').map(r => r.trim()).filter(r => r);
      if (roleList.length > 0) {
        const placeholders = roleList.map(() => '?').join(',');
        whereClause += ` AND u.role IN (${placeholders})`;
        params.push(...roleList);
      }
    }

    if (department_id) {
      console.log('Filtering by department_id:', department_id);
      whereClause += ' AND u.department_id = ?';
      params.push(department_id);
    }

    // Note: We'll handle notInDepartment filtering after the query
    // This is because the SQL filtering wasn't working as expected

    // Debug: Log the final query
    console.log('Final WHERE clause:', whereClause);
    console.log('Final params:', params);

    // Get users with department info
    const finalParams = [...params];
    const sqlQuery = `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.last_login, u.created_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`;
    
    console.log('Final SQL Query:', sqlQuery);
    console.log('Final SQL Params:', finalParams);
    
    const usersResult = await executeQuery(sqlQuery, finalParams);

    // Get total count
    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );

    if (!usersResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch users',
        message: 'Database query failed'
      });
    }

    let filteredUsers = usersResult.data;
    let filteredTotal = countResult.data[0].total;

    // Apply notInDepartment filtering if specified
    if (notInDepartment && notInDepartment !== '') {
      console.log('Filtering users not in department:', notInDepartment);
      filteredUsers = usersResult.data.filter(user => 
        user.department_id !== notInDepartment
      );
      filteredTotal = filteredUsers.length;
      console.log('Filtered users count:', filteredTotal);
    }

    res.json({
      users: filteredUsers,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'An unexpected error occurred'
    });
  }
});

// User history summary (admin only)
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const {
      search = '',
      role = '',
      department_id: departmentId = '',
      page: pageParam = 1,
      limit: limitParam = 20
    } = req.query;

    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 20,
      maxLimit: 100
    });

    const filters = [];
    const params = [];

    if (search) {
      filters.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      filters.push('u.role = ?');
      params.push(role);
    }

    if (departmentId) {
      filters.push('u.department_id = ?');
      params.push(departmentId);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const summaryQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.position,
        u.department_id,
        d.name AS department_name,
        COALESCE(assignments.assignment_count, 0) AS assignment_count,
        COALESCE(assignments.active_assignments, 0) AS active_assignment_count,
        assignments.last_assignment AS last_assignment_at,
        COALESCE(issues_reported.issue_reported_count, 0) AS issues_reported_count,
        issues_reported.last_reported_issue AS last_reported_issue_at,
        COALESCE(issues_assigned.issue_assigned_count, 0) AS issues_assigned_count,
        issues_assigned.last_assigned_issue AS last_assigned_issue_at,
        COALESCE(requests.asset_request_count, 0) AS asset_request_count,
        requests.last_asset_request AS last_asset_request_at,
        GREATEST(
          COALESCE(assignments.last_assignment, '1970-01-01 00:00:00'),
          COALESCE(issues_reported.last_reported_issue, '1970-01-01 00:00:00'),
          COALESCE(issues_assigned.last_assigned_issue, '1970-01-01 00:00:00'),
          COALESCE(requests.last_asset_request, '1970-01-01 00:00:00')
        ) AS last_activity
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) AS assignment_count,
          COUNT(CASE WHEN assignment_type IN ('assign','transfer') AND returned_at IS NULL THEN 1 END) AS active_assignments,
          MAX(COALESCE(returned_at, assigned_at, updated_at)) AS last_assignment
        FROM asset_assignment_history
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) assignments ON assignments.user_id = u.id
      LEFT JOIN (
        SELECT 
          reported_by AS user_id,
          COUNT(*) AS issue_reported_count,
          MAX(updated_at) AS last_reported_issue
        FROM issues
        GROUP BY reported_by
      ) issues_reported ON issues_reported.user_id = u.id
      LEFT JOIN (
        SELECT 
          assigned_to AS user_id,
          COUNT(*) AS issue_assigned_count,
          MAX(updated_at) AS last_assigned_issue
        FROM issues
        WHERE assigned_to IS NOT NULL
        GROUP BY assigned_to
      ) issues_assigned ON issues_assigned.user_id = u.id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) AS asset_request_count,
          MAX(updated_at) AS last_asset_request
        FROM asset_requests
        GROUP BY user_id
      ) requests ON requests.user_id = u.id
      ${whereClause}
      ORDER BY last_activity DESC, u.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM users u ${whereClause}`;

    const [summaryResult, countResult] = await Promise.all([
      executeQuery(summaryQuery, params),
      executeQuery(countQuery, params)
    ]);

    if (!summaryResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch user history summary',
        message: 'Database query failed'
      });
    }

    res.json({
      users: summaryResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get user history summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch user history summary',
      message: 'An unexpected error occurred'
    });
  }
});

const checkTableExists = async (tableName) => {
  const result = await executeQuery(`SHOW TABLES LIKE '${tableName}'`, []);
  return result.success && result.data && result.data.length > 0;
};

router.get('/:id/history', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await executeQuery(
      `SELECT u.*, d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [hasAssignmentHistory, hasIssueHistory, hasAssetRequests] = await Promise.all([
      checkTableExists('asset_assignment_history'),
      checkTableExists('asset_issue_history'),
      checkTableExists('asset_requests')
    ]);

    const assignmentsResult = hasAssignmentHistory
      ? await executeQuery(
          `SELECT h.*,
                  a.name AS asset_name,
                  a.serial_number AS asset_serial,
                  ab.name AS assigned_by_name,
                  d.name AS department_name
           FROM asset_assignment_history h
           LEFT JOIN assets a ON a.id = h.asset_id
           LEFT JOIN users ab ON ab.id = h.assigned_by
           LEFT JOIN departments d ON d.id = h.department_id
           WHERE h.user_id = ?
           ORDER BY h.assigned_at DESC, h.created_at DESC`,
          [id]
        )
      : { success: true, data: [] };

    const reportedIssuesResult = await executeQuery(
      `SELECT i.*, a.name AS asset_name, a.serial_number AS asset_serial, d.name AS department_name
       FROM issues i
       LEFT JOIN assets a ON a.id = i.asset_id
       LEFT JOIN departments d ON d.id = i.department_id
       WHERE i.reported_by = ?
       ORDER BY i.created_at DESC`,
      [id]
    );

    const assignedIssuesResult = await executeQuery(
      `SELECT i.*, a.name AS asset_name, a.serial_number AS asset_serial, d.name AS department_name
       FROM issues i
       LEFT JOIN assets a ON a.id = i.asset_id
       LEFT JOIN departments d ON d.id = i.department_id
       WHERE i.assigned_to = ?
       ORDER BY i.updated_at DESC`,
      [id]
    );

    const issueEventsResult = hasIssueHistory
      ? await executeQuery(
          `SELECT ih.*, i.title AS issue_title, i.priority AS issue_priority
           FROM asset_issue_history ih
           LEFT JOIN issues i ON ih.issue_id = i.id
           WHERE ih.changed_by = ?
           ORDER BY ih.occurred_at DESC, ih.created_at DESC`,
          [id]
        )
      : { success: true, data: [] };

    const assetRequestsResult = hasAssetRequests
      ? await executeQuery(
          `SELECT ar.*
           FROM asset_requests ar
           WHERE ar.user_id = ?
           ORDER BY ar.created_at DESC`,
          [id]
        )
      : { success: true, data: [] };

    res.json({
      user: userResult.data[0],
      assignments: assignmentsResult.success ? assignmentsResult.data : [],
      reportedIssues: reportedIssuesResult.success ? reportedIssuesResult.data : [],
      assignedIssues: assignedIssuesResult.success ? assignedIssuesResult.data : [],
      assetRequests: assetRequestsResult.success ? assetRequestsResult.data : [],
      issueEvents: issueEventsResult.success ? issueEventsResult.data : []
    });
  } catch (error) {
    console.error('Get user history detail error:', error);
    res.status(500).json({
      error: 'Failed to fetch user history',
      message: 'An unexpected error occurred'
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.last_login, u.created_at, u.updated_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: userResult.data[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: 'An unexpected error occurred'
    });
  }
});

// Create new user (admin only)
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 }),
  body('role').isIn(['admin', 'manager', 'user']),
  body('department_id').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }).withMessage('Department ID must be a valid UUID')
], async (req, res) => {
  try {
    console.log('User creation request body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, name, role, department_id, phone, position } = req.body;

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
        error: 'User creation failed',
        message: 'Could not create user account'
      });
    }

    // Get the created user using the generated UUID
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.created_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [userId]
    );

    const createdUser = userResult.data[0];

    // Notify user (DB + email)
    try {
      await notificationService.notifyUserCreation(
        createdUser.id,
        email,
        name,
        password
      );
    } catch (notifyErr) {
      console.error('Failed to send user creation notifications:', notifyErr);
    }

    // Log user creation
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'CREATE',
      'user',
      userId,
      {
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        department_id: createdUser.department_id,
        position: createdUser.position,
        created_by: req.user?.id || null
      },
      ipAddress,
      userAgent
    );

    res.status(201).json({
      message: 'User created successfully',
      user: createdUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'User creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Update user
router.put('/:id', [
  requireAdmin,
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['admin', 'manager', 'user']),
  body('department_id').optional().isUUID(),
  body('phone').optional().trim(),
  body('position').optional().trim(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { name, email, role, department_id, phone, position, is_active } = req.body;

    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.success || existingUser.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const emailCheck = await executeQuery(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (emailCheck.success && emailCheck.data.length > 0) {
        return res.status(400).json({
          error: 'Email already exists',
          message: 'This email is already registered to another user'
        });
      }
    }

    // Check permissions
    const currentUser = req.user;
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile'
      });
    }

    // Regular users can't change role or department
    if (currentUser.role !== 'admin' && (role || department_id !== undefined)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You cannot change role or department'
      });
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
    if (role !== undefined && currentUser.role === 'admin') {
      updates.push('role = ?');
      params.push(role);
    }
    if (department_id !== undefined && currentUser.role === 'admin') {
      updates.push('department_id = ?');
      params.push(department_id);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (position !== undefined) {
      updates.push('position = ?');
      params.push(position);
    }
    if (is_active !== undefined && currentUser.role === 'admin') {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await executeQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'User update failed',
        message: 'Could not update user'
      });
    }

    // Get updated user
    const userResult = await executeQuery(
      `SELECT u.id, u.email, u.name, u.role, u.department_id, u.phone, u.position, 
              u.is_active, u.last_login, u.created_at, u.updated_at, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`,
      [id]
    );

    const updatedUser = userResult.data[0];
    
    // Log user update
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'UPDATE',
      'user',
      id,
      {
        email: updatedUser.email,
        name: updatedUser.name,
        changes: req.body,
        previous_role: existingUser.data[0].role,
        new_role: updatedUser.role
      },
      ipAddress,
      userAgent
    );

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'User update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists and get full details for audit log
    const existingUser = await executeQuery(
      'SELECT id, email, name, role, department_id FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.success || existingUser.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const userToDelete = existingUser.data[0];

    // Prevent deleting self
    if (req.user.id === id) {
      return res.status(400).json({
        error: 'Cannot delete self',
        message: 'You cannot delete your own account'
      });
    }

    // Delete user
    const result = await executeQuery(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'User deletion failed',
        message: 'Could not delete user'
      });
    }

    // Log user deletion (after successful deletion)
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
      const userAgent = req.headers['user-agent'] || null;
      await auditLogger.logCRUD(
        req.user?.id || null,
        'DELETE',
        'user',
        id,
        {
          email: userToDelete.email,
          name: userToDelete.name,
          role: userToDelete.role,
          department_id: userToDelete.department_id,
          deleted_by: req.user?.id || null
        },
        ipAddress,
        userAgent
      );
    } catch (auditError) {
      // Log audit error but don't fail the deletion
      console.error('Failed to log user deletion:', auditError);
    }

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'User deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Admin change user password
router.put('/:id/password', [
  requireAdmin,
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

    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT id, email FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.success || existingUser.data.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const result = await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Password update failed',
        message: 'Could not update password'
      });
    }

    // Notify user about password change (DB + email)
    try {
      await notificationService.createNotification(
        id,
        'Password Changed',
        'Your account password has been changed successfully. If this was not you, contact support immediately.',
        'warning'
      );

      const userEmailResult = await executeQuery('SELECT email, name FROM users WHERE id = ?', [id]);
      if (userEmailResult.success && userEmailResult.data.length > 0) {
        const { email, name } = userEmailResult.data[0];
        const emailSvc = (await import('../services/emailService.js')).default;
        await emailSvc.sendBrandedNotificationEmail(
          email,
          'Your password was changed',
          {
            badge: 'WARNING',
            badgeColor: '#f59e0b',
            title: 'Password Changed',
            greetingName: name || '',
            message: 'Your password was changed successfully. If you did not initiate this change, please contact support immediately.',
            ctaText: 'Open Account Settings',
            ctaUrl: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/profile'
          }
        );
      }
    } catch (notifyErr) {
      console.error('Failed to send password change notifications:', notifyErr);
    }

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.status(500).json({
      error: 'Password update failed',
      message: 'An unexpected error occurred'
    });
  }
});

export default router;

