import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { requireAdmin, requireManager, authenticateToken } from '../middleware/auth.js';
import auditLogger from '../utils/auditLogger.js';
import { sanitizePagination } from '../utils/pagination.js';

const router = express.Router();

// Get all departments
router.get('/', async (req, res) => {
  try {
    const { page: pageParam = 1, limit: limitParam = 1000, search = '' } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = 'WHERE name LIKE ? OR location LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const departmentsResult = await executeQuery(
      `SELECT d.*, 
              COALESCE(u.name, 'Unassigned') as manager,
              COALESCE(user_counts.user_count, 0) as user_count,
              COALESCE(asset_counts.asset_count, 0) as asset_count,
              COALESCE(asset_counts.asset_value, 0) as asset_value
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       LEFT JOIN (
         SELECT department_id, COUNT(*) as user_count
         FROM users 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) user_counts ON d.id = user_counts.department_id
       LEFT JOIN (
         SELECT department_id, 
                COUNT(*) as asset_count,
                COALESCE(SUM(COALESCE(NULLIF(current_value, 0), purchase_price, 0)), 0) as asset_value
         FROM assets 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) asset_counts ON d.id = asset_counts.department_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM departments d ${whereClause}`,
      params
    );

    if (!departmentsResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch departments',
        message: 'Database query failed'
      });
    }

    res.json({
      departments: departmentsResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      error: 'Failed to fetch departments',
      message: 'An unexpected error occurred'
    });
  }
});

// Get department by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const departmentResult = await executeQuery(
      `SELECT d.*, 
              COALESCE(u.name, 'Unassigned') as manager, 
              u.email as manager_email,
              COALESCE(user_counts.user_count, 0) as user_count,
              COALESCE(asset_counts.asset_count, 0) as asset_count,
              COALESCE(asset_counts.asset_value, 0) as asset_value
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       LEFT JOIN (
         SELECT department_id, COUNT(*) as user_count
         FROM users 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) user_counts ON d.id = user_counts.department_id
       LEFT JOIN (
         SELECT department_id, 
                COUNT(*) as asset_count,
                COALESCE(SUM(COALESCE(NULLIF(current_value, 0), purchase_price, 0)), 0) as asset_value
         FROM assets 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) asset_counts ON d.id = asset_counts.department_id
       WHERE d.id = ?`,
      [id]
    );

    if (!departmentResult.success || departmentResult.data.length === 0) {
      return res.status(404).json({
        error: 'Department not found'
      });
    }

    res.json({
      department: departmentResult.data[0]
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      error: 'Failed to fetch department',
      message: 'An unexpected error occurred'
    });
  }
});

// Create department (admin/manager only)
router.post('/', [
  requireManager,
  body('name').trim().isLength({ min: 2 }),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('manager_id').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, description, location, manager_id, parent_id } = req.body;

    // Check if department already exists
    const existingDept = await executeQuery(
      'SELECT id FROM departments WHERE name = ?',
      [name]
    );

    if (existingDept.success && existingDept.data.length > 0) {
      return res.status(400).json({
        error: 'Department already exists',
        message: 'A department with this name already exists'
      });
    }

    // Generate UUID for the department (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const departmentId = randomUUID();

    // Create department with default location
    const result = await executeQuery(
      `INSERT INTO departments (id, name, description, location, manager_id, parent_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [departmentId, name, description || null, location || 'Turnkey Africa', manager_id || null, parent_id || null]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Department creation failed',
        message: 'Could not create department'
      });
    }

    // Handle role synchronization for new manager
    if (manager_id) {
      try {
        await executeQuery(
          'UPDATE users SET role = ? WHERE id = ? AND role = ?',
          ['manager', manager_id, 'user']
        );
      } catch (roleError) {
        console.error('Role synchronization error:', roleError);
        // Don't fail the department creation if role sync fails
      }
    }

    // Get the created department using the generated UUID
    const departmentResult = await executeQuery(
      `SELECT d.*, COALESCE(u.name, 'Unassigned') as manager
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       WHERE d.id = ?`,
      [departmentId]
    );

    const createdDepartment = departmentResult.data[0];

    // Log department creation
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'CREATE',
      'department',
      departmentId,
      {
        name: createdDepartment.name,
        location: createdDepartment.location,
        manager_id: createdDepartment.manager_id,
        parent_id: createdDepartment.parent_id
      },
      ipAddress,
      userAgent
    );

    res.status(201).json({
      message: 'Department created successfully',
      department: createdDepartment
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      error: 'Department creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Update department
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 2 }),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('manager_id').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }),
  body('parent_id').optional().custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  })
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
    const { name, description, location, manager_id, parent_id } = req.body;

    // Check if department exists and get current manager
    const existingDept = await executeQuery(
      'SELECT id, manager_id FROM departments WHERE id = ?',
      [id]
    );

    if (!existingDept.success || existingDept.data.length === 0) {
      return res.status(404).json({
        error: 'Department not found'
      });
    }

    const currentManagerId = existingDept.data[0].manager_id;

    // Check if name is unique (if changing)
    if (name) {
      const nameCheck = await executeQuery(
        'SELECT id FROM departments WHERE name = ? AND id != ?',
        [name, id]
      );

      if (nameCheck.success && nameCheck.data.length > 0) {
        return res.status(400).json({
          error: 'Department name already exists',
          message: 'A department with this name already exists'
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (manager_id !== undefined) {
      updates.push('manager_id = ?');
      params.push(manager_id);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      params.push(parent_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await executeQuery(
      `UPDATE departments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Department update failed',
        message: 'Could not update department'
      });
    }

    // Handle role synchronization for manager changes
    if (manager_id !== undefined && manager_id !== currentManagerId) {
      try {
        // If there was a previous manager, revert their role to 'user'
        if (currentManagerId) {
          await executeQuery(
            'UPDATE users SET role = ? WHERE id = ? AND role = ?',
            ['user', currentManagerId, 'manager']
          );
        }

        // If there's a new manager, set their role to 'manager'
        if (manager_id) {
          await executeQuery(
            'UPDATE users SET role = ? WHERE id = ? AND role = ?',
            ['manager', manager_id, 'user']
          );
        }
      } catch (roleError) {
        console.error('Role synchronization error:', roleError);
        // Don't fail the department update if role sync fails
        // Log the error but continue with the response
      }
    }

    // Get updated department
    const departmentResult = await executeQuery(
      `SELECT d.*, COALESCE(u.name, 'Unassigned') as manager
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       WHERE d.id = ?`,
      [id]
    );

    const updatedDepartment = departmentResult.data[0];

    // Log department update
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'UPDATE',
      'department',
      id,
      {
        name: updatedDepartment.name,
        changes: req.body,
        previous_manager: currentManagerId,
        new_manager: updatedDepartment.manager_id
      },
      ipAddress,
      userAgent
    );

    res.json({
      message: 'Department updated successfully',
      department: updatedDepartment
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      error: 'Department update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete department (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department exists and get manager
    const existingDept = await executeQuery(
      'SELECT id, name, manager_id FROM departments WHERE id = ?',
      [id]
    );

    if (!existingDept.success || existingDept.data.length === 0) {
      return res.status(404).json({
        error: 'Department not found'
      });
    }

    const managerId = existingDept.data[0].manager_id;

    // Handle dependencies before deletion

    // 1. Revert manager's role to 'user' if they exist
    if (managerId) {
      try {
        await executeQuery(
          'UPDATE users SET role = ? WHERE id = ? AND role = ?',
          ['user', managerId, 'manager']
        );
        console.log('Manager role reverted to user for:', managerId);
      } catch (roleError) {
        console.error('Role synchronization error:', roleError);
      }
    }

    // 2. Remove department association from users (set department_id to NULL)
    try {
      const usersUpdateResult = await executeQuery(
        'UPDATE users SET department_id = NULL WHERE department_id = ?',
        [id]
      );
      console.log('Users unassociated from department:', usersUpdateResult.data?.affectedRows || 0);
    } catch (usersError) {
      console.error('Error unassociating users:', usersError);
    }

    // 3. Remove department association from assets (set department_id to NULL)
    try {
      const assetsUpdateResult = await executeQuery(
        'UPDATE assets SET department_id = NULL WHERE department_id = ?',
        [id]
      );
      console.log('Assets unassociated from department:', assetsUpdateResult.data?.affectedRows || 0);
    } catch (assetsError) {
      console.error('Error unassociating assets:', assetsError);
    }

    // Delete department
    const result = await executeQuery(
      'DELETE FROM departments WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Department deletion failed',
        message: 'Could not delete department'
      });
    }

    // Log department deletion
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'DELETE',
      'department',
      id,
      {
        name: existingDept.data[0].name,
        location: existingDept.data[0].location,
        manager_id: existingDept.data[0].manager_id
      },
      ipAddress,
      userAgent
    );

    res.json({
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      error: 'Department deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

export default router;

