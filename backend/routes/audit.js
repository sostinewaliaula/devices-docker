import express from 'express';
import { executeQuery } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { sanitizePagination } from '../utils/pagination.js';

const router = express.Router();

// Get audit logs (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { 
      page: pageParam = 1, 
      limit: limitParam = 50, 
      user_id = '', 
      action = '', 
      entity_type = '',
      start_date = '',
      end_date = ''
    } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 50,
      maxLimit: 1000
    });

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    if (entity_type) {
      whereClause += ' AND entity_type = ?';
      params.push(entity_type);
    }

    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    const auditResult = await executeQuery(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );

    if (!auditResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch audit logs',
        message: 'Database query failed'
      });
    }

    res.json({
      audit_logs: auditResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'An unexpected error occurred'
    });
  }
});

// Get audit log by ID (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const auditResult = await executeQuery(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = ?`,
      [id]
    );

    if (!auditResult.success || auditResult.data.length === 0) {
      return res.status(404).json({
        error: 'Audit log not found'
      });
    }

    res.json({
      audit_log: auditResult.data[0]
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit log',
      message: 'An unexpected error occurred'
    });
  }
});

// Get audit statistics (admin only)
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    const { start_date = '', end_date = '' } = req.query;

    let whereClause = '';
    const params = [];

    if (start_date && end_date) {
      whereClause = 'WHERE created_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const statsResult = await executeQuery(
      `SELECT 
         COUNT(*) as total_actions,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT action) as unique_actions,
         COUNT(DISTINCT entity_type) as unique_entity_types,
         SUM(CASE WHEN action = 'CREATE' THEN 1 ELSE 0 END) as create_count,
         SUM(CASE WHEN action = 'UPDATE' THEN 1 ELSE 0 END) as update_count,
         SUM(CASE WHEN action = 'DELETE' THEN 1 ELSE 0 END) as delete_count,
         SUM(CASE WHEN action = 'LOGIN' THEN 1 ELSE 0 END) as login_count,
         SUM(CASE WHEN action = 'LOGOUT' THEN 1 ELSE 0 END) as logout_count
       FROM audit_logs 
       ${whereClause}`,
      params
    );

    if (!statsResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch audit statistics',
        message: 'Database query failed'
      });
    }

    res.json({
      statistics: statsResult.data[0]
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit statistics',
      message: 'An unexpected error occurred'
    });
  }
});

// Get audit logs by user (admin only)
router.get('/user/:user_id', requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page: pageParam = 1, limit: limitParam = 50 } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 50,
      maxLimit: 1000
    });

    const auditResult = await executeQuery(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.user_id = ?
       ORDER BY al.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [user_id]
    );

    const countResult = await executeQuery(
      'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?',
      [user_id]
    );

    if (!auditResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch user audit logs',
        message: 'Database query failed'
      });
    }

    res.json({
      audit_logs: auditResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      error: 'Failed to fetch user audit logs',
      message: 'An unexpected error occurred'
    });
  }
});

// Write audit log
router.post('/', async (req, res) => {
  try {
    const { user_id, action, entity_type, entity_id, details } = req.body;
    
    if (!user_id || !action || !entity_type) {
      return res.status(400).json({ 
        message: 'Missing required fields: user_id, action, entity_type' 
      });
    }

    const result = await executeQuery(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      [user_id, action, entity_type, entity_id || null, JSON.stringify(details || {})]
    );

    const auditLog = {
      id: result.insertId,
      user_id,
      action,
      entity_type,
      entity_id,
      details: details || {},
      created_at: new Date().toISOString()
    };

    res.status(201).json(auditLog);
  } catch (error) {
    console.error('Error writing audit log:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

export default router;

