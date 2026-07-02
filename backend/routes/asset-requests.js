import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import notificationService from '../services/notificationService.js';
import commentService from '../services/commentService.js';
import { sanitizePagination } from '../utils/pagination.js';

const router = express.Router();

function parseEstimatedCostInput(input) {
  if (input === undefined) {
    return { provided: false, value: null };
  }
  if (input === null || input === '') {
    return { provided: true, value: null };
  }
  const numericValue = typeof input === 'number' ? input : parseFloat(input);
  if (Number.isNaN(numericValue) || numericValue < 0) {
    return { provided: true, error: 'invalid' };
  }
  return { provided: true, value: Number(numericValue) };
}

// Get all asset requests
router.get('/', async (req, res) => {
  try {
    const { 
      page: pageParam = 1, 
      limit: limitParam = 1000, 
      search = '', 
      status = '', 
      priority = '',
      userId = '',
      includeCostSummary: includeCostSummaryParam = 'false'
    } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });
    const canViewCostDetails = req.user?.role === 'admin';
    const includeCostSummary = canViewCostDetails && (includeCostSummaryParam === 'true' || includeCostSummaryParam === '1');

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (ar.asset_name LIKE ? OR ar.reason LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND ar.status = ?';
      params.push(status);
    }

    if (priority) {
      whereClause += ' AND ar.priority = ?';
      params.push(priority);
    }

    if (userId) {
      whereClause += ' AND ar.user_id = ?';
      params.push(userId);
    }

    const requestsResult = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email,
              approver.name as approved_by_name
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN users approver ON ar.approved_by = approver.id
       ${whereClause}
       ORDER BY ar.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM asset_requests ar ${whereClause}`,
      params
    );

    if (!requestsResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch asset requests',
        message: 'Database query failed'
      });
    }

    let costSummary = null;
    if (includeCostSummary) {
      const summaryResult = await executeQuery(
        `SELECT COALESCE(SUM(ar.estimated_cost), 0) as total_estimated_cost
         FROM asset_requests ar
         ${whereClause}`,
        params
      );

      if (summaryResult.success && summaryResult.data.length > 0) {
        costSummary = {
          total_estimated_cost: Number(summaryResult.data[0].total_estimated_cost) || 0,
          currency: process.env.DEFAULT_CURRENCY || 'KES'
        };
      }
    }

    const assetRequests = requestsResult.data.map(request => {
      const costValue = request.estimated_cost === null || request.estimated_cost === undefined
        ? null
        : Number(request.estimated_cost);
      return {
        ...request,
        estimated_cost: canViewCostDetails ? costValue : null
      };
    });

    const responsePayload = {
      asset_requests: assetRequests,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    };

    if (costSummary) {
      responsePayload.cost_summary = costSummary;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Get asset requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset requests',
      message: 'An unexpected error occurred'
    });
  }
});

// Get asset request by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const requestResult = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email,
              approver.name as approved_by_name
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN users approver ON ar.approved_by = approver.id
       WHERE ar.id = ?`,
      [id]
    );

    if (!requestResult.success || requestResult.data.length === 0) {
      return res.status(404).json({
        error: 'Asset request not found'
      });
    }

    const request = requestResult.data[0];
    request.estimated_cost = (req.user?.role === 'admin' && request.estimated_cost !== null && request.estimated_cost !== undefined)
      ? Number(request.estimated_cost)
      : null;

    res.json({
      asset_request: request
    });
  } catch (error) {
    console.error('Get asset request error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset request',
      message: 'An unexpected error occurred'
    });
  }
});

// Create asset request
router.post('/', [
  body('user_id').trim().isLength({ min: 1 }),
  body('asset_name').trim().isLength({ min: 2 }),
  body('asset_type').trim().isLength({ min: 2 }),
  body('category').trim().isLength({ min: 2 }),
  body('reason').trim().isLength({ min: 10 }),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']),
  body('estimated_cost').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      user_id, asset_name, asset_type, category, reason, priority, notes, estimated_cost
    } = req.body;

    const parsedEstimatedCost = parseEstimatedCostInput(estimated_cost);
    if (parsedEstimatedCost.error) {
      return res.status(400).json({
        error: 'Invalid estimated cost',
        message: 'Estimated cost must be a positive number'
      });
    }

    if (parsedEstimatedCost.provided && req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins can set estimated cost'
      });
    }

    // Generate UUID for the asset request (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const requestId = randomUUID();

    // Create asset request
    const result = await executeQuery(
      `INSERT INTO asset_requests (id, user_id, asset_name, asset_type, category, reason, priority, notes, estimated_cost, requested_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [requestId, user_id, asset_name, asset_type, category, reason, priority, notes || null, parsedEstimatedCost.value]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset request creation failed',
        message: 'Could not create asset request'
      });
    }

    // Get the created asset request using the generated UUID
    const requestResult = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       WHERE ar.id = ?`,
      [requestId]  // Use the generated UUID instead of insertId
    );

    const created = requestResult.data[0];
    console.log(`🔔 Sending notifications for asset request "${asset_name}" by ${created.user_name || user_id}`);

    // Notify user and department managers
    try {
      // Notify requester
      await notificationService.createNotification(
        created.user_id,
        null,
        'success',
        'Asset Request Submitted',
        `Your request for ${created.asset_name} has been submitted and is pending review.`
      );

      // Send email notification to requester
      if (created.user_email) {
        const userPrefsResult = await executeQuery(
          `SELECT email_notifications FROM users WHERE id = ?`,
          [created.user_id]
        );

        if (userPrefsResult.success && userPrefsResult.data && userPrefsResult.data.length > 0 && userPrefsResult.data[0].email_notifications) {
          const emailSubject = 'Your Asset Request Has Been Submitted';
          const emailHtml = notificationService.generateUserNewRequestEmailHtml(
            created.user_name || 'User',
            created.asset_name,
            created.asset_type,
            created.reason
          );
          const emailText = notificationService.generateUserNewRequestEmailText(
            created.user_name || 'User',
            created.asset_name,
            created.asset_type,
            created.reason
          );

          await notificationService.sendEmailNotification(
            created.user_email,
            emailSubject,
            emailHtml,
            emailText
          );
        }
      }

      // Notify managers in same department as requester (only managers, not admins)
      const managersResult = await executeQuery(
        `SELECT id, name, email FROM users WHERE department_id = (SELECT department_id FROM users WHERE id = ?) AND role = 'manager' AND is_active = TRUE`,
        [created.user_id]
      );
      if (managersResult.success) {
        for (const mgr of managersResult.data) {
          await notificationService.createNotification(
            mgr.id,
            null,
            'info',
            'New Asset Request Submitted',
            `${created.user_name || 'A user'} requested ${created.asset_name} (${created.asset_type}).`
          );

          // Send email notification to manager
          if (mgr.email) {
            const managerPrefsResult = await executeQuery(
              `SELECT email_notifications FROM users WHERE id = ?`,
              [mgr.id]
            );

            if (managerPrefsResult.success && managerPrefsResult.data && managerPrefsResult.data.length > 0 && managerPrefsResult.data[0].email_notifications) {
              const emailSubject = 'Team Member Submitted New Asset Request';
              const emailHtml = notificationService.generateManagerNewRequestEmailHtml(
                mgr.name || 'Manager',
                created.user_name || 'A user',
                created.asset_name,
                created.asset_type,
                created.reason
              );
              const emailText = notificationService.generateManagerNewRequestEmailText(
                mgr.name || 'Manager',
                created.user_name || 'A user',
                created.asset_name,
                created.asset_type,
                created.reason
              );

              await notificationService.sendEmailNotification(
              mgr.email,
                emailSubject,
                emailHtml,
                emailText
              );
            }
          }
        }
      }

      // Notify all admins (regardless of department)
      const adminsResult = await executeQuery(
        `SELECT id, name, email FROM users WHERE role = 'admin' AND is_active = TRUE`,
        []
      );
      if (adminsResult.success) {
        for (const admin of adminsResult.data) {
          // Create in-app notification for admins
          await notificationService.createNotification(
            admin.id,
            null,
            'info',
              'New Asset Request Submitted',
            `${created.user_name || 'A user'} requested ${created.asset_name} (${created.asset_type}).`
          );

          // Send email notification to admin for new requests
          if (admin.email) {
            const adminPrefsResult = await executeQuery(
              `SELECT email_notifications FROM users WHERE id = ?`,
              [admin.id]
            );

            if (adminPrefsResult.success && adminPrefsResult.data && adminPrefsResult.data.length > 0 && adminPrefsResult.data[0].email_notifications) {
              const emailSubject = 'New Asset Request Submitted';
              const emailHtml = notificationService.generateAdminNewRequestEmailHtml(
                admin.name || 'Admin',
                created.user_name || 'A user',
                created.asset_name,
                created.asset_type,
                created.reason
              );
              const emailText = notificationService.generateAdminNewRequestEmailText(
                admin.name || 'Admin',
                created.user_name || 'A user',
                created.asset_name,
                created.asset_type,
                created.reason
              );

              await notificationService.sendEmailNotification(
                admin.email,
                emailSubject,
                emailHtml,
                emailText
              );
            }
          }
        }
      }
      
      console.log(`✅ Asset request notifications sent for: ${requestId}`);
    } catch (notifyErr) {
      console.error('Failed to send asset request notifications:', notifyErr);
    }

    res.status(201).json({
      message: 'Asset request created successfully',
      asset_request: requestResult.data[0]
    });
  } catch (error) {
    console.error('Create asset request error:', error);
    res.status(500).json({
      error: 'Asset request creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Update asset request (user only - asset_name, asset_type, reason)
router.put('/:id/user', [
  body('asset_name').optional().isLength({ min: 1 }).trim(),
  body('asset_type').optional().isLength({ min: 1 }).trim(),
  body('reason').optional().isLength({ min: 1 }).trim()
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
    const { asset_name, asset_type, reason } = req.body;

    // Check if request exists and belongs to the user
    const existingRequest = await executeQuery(
      'SELECT id, user_id, status FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!existingRequest.success || existingRequest.data.length === 0) {
      return res.status(404).json({
        error: 'Asset request not found'
      });
    }

    const request = existingRequest.data[0];

    // Check if the request belongs to the authenticated user
    if (request.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only edit your own requests'
      });
    }

    // Check if request can be edited (only pending requests)
    if (request.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot edit request',
        message: 'Only pending requests can be edited'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (asset_name !== undefined) {
      updates.push('asset_name = ?');
      params.push(asset_name);
    }
    if (asset_type !== undefined) {
      updates.push('asset_type = ?');
      params.push(asset_type);
    }
    if (reason !== undefined) {
      updates.push('reason = ?');
      params.push(reason);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await executeQuery(
      `UPDATE asset_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset request update failed',
        message: 'Could not update asset request'
      });
    }

    // Get updated asset request
    const requestResult = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       WHERE ar.id = ?`,
      [id]
    );

    res.json({
      message: 'Asset request updated successfully',
      asset_request: {
        ...requestResult.data[0],
        estimated_cost: req.user?.role === 'admin' && requestResult.data[0].estimated_cost !== null && requestResult.data[0].estimated_cost !== undefined
          ? Number(requestResult.data[0].estimated_cost)
          : null
      }
    });
  } catch (error) {
    console.error('Update asset request error:', error);
    res.status(500).json({
      error: 'Asset request update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Update asset request (admin only - status, priority, notes)
router.put('/:id', [
  body('status').optional().isIn(['pending', 'approved', 'rejected', 'fulfilled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('estimated_cost').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 })
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
    const {
      status, priority, notes, approved_by, estimated_cost
    } = req.body;

    // Check if request exists
    const existingRequest = await executeQuery(
      'SELECT id, user_id, status FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!existingRequest.success || existingRequest.data.length === 0) {
      return res.status(404).json({
        error: 'Asset request not found'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (approved_by !== undefined) {
      updates.push('approved_by = ?');
      params.push(approved_by);
    }
    if (status === 'approved' || status === 'rejected') {
      updates.push('approved_date = CURDATE()');
    }
    if (estimated_cost !== undefined) {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Only admins can update estimated cost'
        });
      }
      const parsedCost = parseEstimatedCostInput(estimated_cost);
      if (parsedCost.error) {
        return res.status(400).json({
          error: 'Invalid estimated cost',
          message: 'Estimated cost must be a positive number'
        });
      }
      updates.push('estimated_cost = ?');
      params.push(parsedCost.value);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await executeQuery(
      `UPDATE asset_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset request update failed',
        message: 'Could not update asset request'
      });
    }

    // Get updated asset request
    const requestResult = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email,
              approver.name as approved_by_name
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN users approver ON ar.approved_by = approver.id
       WHERE ar.id = ?`,
      [id]
    );

    const updated = requestResult.data[0];

    // Notify requester on status change (async, non-blocking)
      if (status !== undefined) {
        // Get the old status for comparison
        const oldStatus = existingRequest.data[0].status;
        
        // Get admin name for notification
        const adminName = req.user ? req.user.name : 'System';
        
      // Run notifications in background without awaiting
      notificationService.notifyStatusChange(
          id,
          oldStatus,
          status,
          adminName
      ).catch(notifyErr => {
      console.error('Failed to send asset request update notifications:', notifyErr);
      });
    }

    res.json({
      message: 'Asset request updated successfully',
      asset_request: {
        ...requestResult.data[0],
        estimated_cost: req.user?.role === 'admin' && requestResult.data[0].estimated_cost !== null && requestResult.data[0].estimated_cost !== undefined
          ? Number(requestResult.data[0].estimated_cost)
          : null
      }
    });
  } catch (error) {
    console.error('Update asset request error:', error);
    res.status(500).json({
      error: 'Asset request update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete asset request (user only)
router.delete('/:id/user', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if request exists and belongs to the user
    const existingRequest = await executeQuery(
      'SELECT id, user_id, status FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!existingRequest.success || existingRequest.data.length === 0) {
      return res.status(404).json({
        error: 'Asset request not found'
      });
    }

    const request = existingRequest.data[0];

    // Check if the request belongs to the authenticated user
    if (request.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own requests'
      });
    }

    // Check if request can be deleted (only pending requests)
    if (request.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot delete request',
        message: 'Only pending requests can be deleted'
      });
    }

// Delete asset request
    const result = await executeQuery(
      'DELETE FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset request deletion failed',
        message: 'Could not delete asset request'
      });
    }

    res.json({
      message: 'Asset request deleted successfully'
    });
  } catch (error) {
    console.error('Delete asset request error:', error);
    res.status(500).json({
      error: 'Asset request deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete asset request (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if request exists
    const existingRequest = await executeQuery(
      'SELECT id FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!existingRequest.success || existingRequest.data.length === 0) {
      return res.status(404).json({
        error: 'Asset request not found'
      });
    }

    // Delete asset request
    const result = await executeQuery(
      'DELETE FROM asset_requests WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset request deletion failed',
        message: 'Could not delete asset request'
      });
    }

    res.json({
      message: 'Asset request deleted successfully'
    });
  } catch (error) {
    console.error('Delete asset request error:', error);
    res.status(500).json({
      error: 'Asset request deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Comment routes are handled by /api/comments

export default router;
