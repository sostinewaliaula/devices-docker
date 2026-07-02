import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { sanitizePagination } from '../utils/pagination.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import auditLogger from '../utils/auditLogger.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router = express.Router();

// Get all assets
router.get('/', async (req, res) => {
  try {
    const {
      page: pageParam = 1,
      limit: limitParam = 1000,
      search = '',
      status = '',
      type = '',
      department_id = '',
      assigned_to = '',
      notInDepartment = ''
    } = req.query;

    // Debug logging
    // console.log('Assets API called with params:', { page, limit, search, status, type, department_id, assigned_to, notInDepartment });
    // console.log('notInDepartment type:', typeof notInDepartment);
    // console.log('notInDepartment value:', JSON.stringify(notInDepartment));
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (a.name LIKE ? OR a.serial_number LIKE ? OR a.manufacturer LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    if (type) {
      whereClause += ' AND a.type = ?';
      params.push(type);
    }

    if (department_id) {
      // console.log('Filtering assets by department_id:', department_id);
      whereClause += ' AND a.department_id = ?';
      params.push(department_id);
    }

    if (assigned_to) {
      whereClause += ' AND a.assigned_to = ?';
      params.push(assigned_to);
    }

    // Note: We'll handle notInDepartment filtering after the query
    // This is because the SQL filtering wasn't working as expected

    // Debug: Log the final query
    // console.log('Final WHERE clause:', whereClause);
    // console.log('Final params:', params);

    const finalParams = [...params];
    const sqlQuery = `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email,
              d.name as department_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN departments d ON a.department_id = d.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`;

    // console.log('Final SQL Query:', sqlQuery);
    // console.log('Final SQL Params:', finalParams);

    const assetsResult = await executeQuery(sqlQuery, finalParams);

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM assets a ${whereClause}`,
      params
    );

    if (!assetsResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch assets',
        message: 'Database query failed'
      });
    }

    let filteredAssets = assetsResult.data;
    let filteredTotal = countResult.data[0].total;

    // Apply notInDepartment filtering if specified
    if (notInDepartment && notInDepartment !== '') {
      // console.log('Filtering assets not in department:', notInDepartment);
      filteredAssets = assetsResult.data.filter(asset =>
        asset.department_id !== notInDepartment
      );
      filteredTotal = filteredAssets.length;
      // console.log('Filtered assets count:', filteredTotal);
    }

    res.json({
      assets: filteredAssets,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
      }
    });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({
      error: 'Failed to fetch assets',
      message: 'An unexpected error occurred'
    });
  }
});

// Get comprehensive asset history
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    const assetResult = await executeQuery(
      `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email,
              d.name as department_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    if (!assetResult.success || assetResult.data.length === 0) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    const assignmentHistoryResult = await executeQuery(
      `SELECT h.*,
              u.name as user_name,
              u.email as user_email,
              ab.name as assigned_by_name,
              d.name as department_name
       FROM asset_assignment_history h
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN users ab ON h.assigned_by = ab.id
       LEFT JOIN departments d ON h.department_id = d.id
       WHERE h.asset_id = ?
       ORDER BY h.assigned_at DESC, h.created_at DESC`,
      [id]
    );

    const issueHistoryResult = await executeQuery(
      `SELECT h.*,
              i.title as issue_title,
              i.priority as issue_priority,
              i.status as current_issue_status
       FROM asset_issue_history h
       LEFT JOIN issues i ON h.issue_id = i.id
       WHERE h.asset_id = ?
       ORDER BY h.occurred_at DESC, h.created_at DESC`,
      [id]
    );

    res.json({
      asset: assetResult.data[0],
      assignments: assignmentHistoryResult.success ? assignmentHistoryResult.data : [],
      issueEvents: issueHistoryResult.success ? issueHistoryResult.data : []
    });
  } catch (error) {
    console.error('Get asset history error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset history',
      message: 'An unexpected error occurred'
    });
  }
});

const checkTableExists = async (tableName) => {
  const result = await executeQuery(`SHOW TABLES LIKE '${tableName}'`, []);
  return result.success && result.data && result.data.length > 0;
};

router.get('/history/summary', async (req, res) => {
  try {
    const {
      search = '',
      status = '',
      type = '',
      department_id = '',
      page: pageParam = 1,
      limit: limitParam = 20
    } = req.query;

    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 20,
      maxLimit: 100
    });

    const [hasAssignmentHistory, hasIssueHistory] = await Promise.all([
      checkTableExists('asset_assignment_history'),
      checkTableExists('asset_issue_history')
    ]);

    const filters = [];
    const params = [];

    if (search) {
      filters.push('(a.name LIKE ? OR a.serial_number LIKE ? OR a.type LIKE ? OR a.location LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      filters.push('a.status = ?');
      params.push(status);
    }

    if (type) {
      filters.push('a.type = ?');
      params.push(type);
    }

    if (department_id) {
      filters.push('a.department_id = ?');
      params.push(department_id);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const assignmentSubquery = hasAssignmentHistory
      ? `
        LEFT JOIN (
          SELECT 
            asset_id,
            COUNT(*) AS assignment_count,
            COUNT(CASE WHEN assignment_type IN ('assign','transfer') AND returned_at IS NULL THEN 1 END) AS active_assignments,
            MAX(COALESCE(returned_at, assigned_at, updated_at)) AS last_assignment
          FROM asset_assignment_history
          GROUP BY asset_id
        ) assignments ON assignments.asset_id = a.id
      `
      : `
        LEFT JOIN (
          SELECT NULL AS asset_id, 0 AS assignment_count, 0 AS active_assignments, NULL AS last_assignment
        ) assignments ON 1=0
      `;

    const issueSubquery = `
      LEFT JOIN (
        SELECT 
          asset_id,
          COUNT(*) AS issue_count,
          COUNT(CASE WHEN status NOT IN ('resolved','closed') THEN 1 END) AS open_issue_count,
          MAX(updated_at) AS last_issue
        FROM issues
        WHERE asset_id IS NOT NULL
        GROUP BY asset_id
      ) issues ON issues.asset_id = a.id
    `;

    const issueEventSubquery = hasIssueHistory
      ? `
        LEFT JOIN (
          SELECT 
            asset_id,
            COUNT(*) AS issue_event_count,
            MAX(occurred_at) AS last_issue_event
          FROM asset_issue_history
          GROUP BY asset_id
        ) events ON events.asset_id = a.id
      `
      : `
        LEFT JOIN (
          SELECT NULL AS asset_id, 0 AS issue_event_count, NULL AS last_issue_event
        ) events ON 1=0
      `;

    const summaryQuery = `
      SELECT 
        a.id,
        a.name,
        a.serial_number,
        a.type,
        a.location,
        a.status,
        COALESCE(assignments.assignment_count, 0) AS assignment_count,
        COALESCE(assignments.active_assignments, 0) AS active_assignment_count,
        COALESCE(assignments.last_assignment, '1970-01-01 00:00:00') AS last_assignment_at,
        COALESCE(issues.issue_count, 0) AS issue_count,
        COALESCE(issues.open_issue_count, 0) AS open_issue_count,
        COALESCE(events.issue_event_count, 0) AS issue_event_count,
        GREATEST(
          COALESCE(assignments.last_assignment, '1970-01-01 00:00:00'),
          COALESCE(issues.last_issue, '1970-01-01 00:00:00'),
          COALESCE(events.last_issue_event, '1970-01-01 00:00:00'),
          COALESCE(a.updated_at, '1970-01-01 00:00:00')
        ) AS last_activity
      FROM assets a
      ${assignmentSubquery}
      ${issueSubquery}
      ${issueEventSubquery}
      ${whereClause}
      ORDER BY last_activity DESC, a.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countQuery = `SELECT COUNT(*) AS total FROM assets a ${whereClause}`;

    const [summaryResult, countResult] = await Promise.all([
      executeQuery(summaryQuery, params),
      executeQuery(countQuery, params)
    ]);

    if (!summaryResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch asset history summary',
        message: 'Database query failed'
      });
    }

    res.json({
      assets: summaryResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get asset history summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset history summary',
      message: 'An unexpected error occurred'
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    const {
      asset_id: assetId = '',
      owner_id: ownerId = '',
      entry_type: entryType = '',
      event_type: eventType = '',
      search = '',
      start_date: startDate = '',
      end_date: endDate = '',
      page: pageParam = 1,
      limit: limitParam = 50
    } = req.query;

    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 50,
      maxLimit: 200
    });

    const [hasAssignmentHistory, hasIssueHistory] = await Promise.all([
      checkTableExists('asset_assignment_history'),
      checkTableExists('asset_issue_history')
    ]);

    const unionParts = [];

    if (hasAssignmentHistory) {
      unionParts.push(`
        SELECT h.id AS history_id,
               a.id AS asset_id,
               a.name AS asset_name,
               a.serial_number AS asset_serial,
               'assignment' AS entry_category,
               h.assignment_type AS event_type,
               NULL AS issue_id,
               NULL AS issue_title,
               NULL AS issue_priority,
               h.user_id AS owner_id,
               u.name AS owner_name,
               d.name AS department_name,
               h.assigned_by AS actor_id,
               ab.name AS actor_name,
               h.notes,
               CASE
                 WHEN h.assignment_type IN ('return','unassign') AND h.returned_at IS NOT NULL THEN h.returned_at
                 ELSE h.assigned_at
               END AS occurred_at,
               h.condition_on_assign,
               h.condition_on_return,
               CASE
                 WHEN h.assignment_type IN ('return','unassign') THEN 'returned'
                 ELSE 'assigned'
               END AS status
        FROM asset_assignment_history h
        LEFT JOIN assets a ON a.id = h.asset_id
        LEFT JOIN users u ON u.id = h.user_id
        LEFT JOIN users ab ON ab.id = h.assigned_by
        LEFT JOIN departments d ON d.id = h.department_id
      `);
    }

    if (hasIssueHistory) {
      unionParts.push(`
        SELECT ih.id AS history_id,
               ih.asset_id,
               a.name,
               a.serial_number,
               'issue' AS entry_category,
               ih.event_type,
               ih.issue_id,
               i.title,
               i.priority,
               i.assigned_to AS owner_id,
               assigned.name AS owner_name,
               d.name AS department_name,
               ih.changed_by AS actor_id,
               actor.name AS actor_name,
               ih.details AS notes,
               ih.occurred_at AS occurred_at,
               NULL AS condition_on_assign,
               NULL AS condition_on_return,
               ih.status AS status
        FROM asset_issue_history ih
        LEFT JOIN assets a ON a.id = ih.asset_id
        LEFT JOIN issues i ON i.id = ih.issue_id
        LEFT JOIN users assigned ON assigned.id = i.assigned_to
        LEFT JOIN users actor ON actor.id = ih.changed_by
        LEFT JOIN departments d ON d.id = i.department_id
      `);
    }

    if (unionParts.length === 0) {
      return res.json({
        entries: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
    }

    const historyUnion = unionParts.join('\nUNION ALL\n');

    const filters = [];
    const params = [];

    if (assetId) {
      filters.push('history_data.asset_id = ?');
      params.push(assetId);
    }

    if (ownerId) {
      filters.push('history_data.owner_id = ?');
      params.push(ownerId);
    }

    if (entryType) {
      filters.push('history_data.entry_category = ?');
      params.push(entryType);
    }

    if (eventType) {
      const eventTypes = String(eventType).split(',').map(v => v.trim()).filter(Boolean);
      if (eventTypes.length === 1) {
        filters.push('history_data.event_type = ?');
        params.push(eventTypes[0]);
      } else if (eventTypes.length > 1) {
        filters.push(`history_data.event_type IN (${eventTypes.map(() => '?').join(',')})`);
        params.push(...eventTypes);
      }
    }

    if (search) {
      filters.push('(history_data.asset_name LIKE ? OR history_data.asset_serial LIKE ? OR history_data.owner_name LIKE ? OR history_data.issue_title LIKE ?)');
      for (let i = 0; i < 4; i += 1) {
        params.push(`%${search}%`);
      }
    }

    if (startDate) {
      filters.push('history_data.occurred_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      filters.push('history_data.occurred_at <= ?');
      params.push(endDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeOffset = Math.max(0, Number(offset) || 0);

    const paginatedQuery = `
      SELECT *
      FROM (${historyUnion}) AS history_data
      ${whereClause}
      ORDER BY history_data.occurred_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM (${historyUnion}) AS history_data
      ${whereClause}
    `;

    const [entriesResult, countResult] = await Promise.all([
      executeQuery(paginatedQuery, params),
      executeQuery(countQuery, params)
    ]);

    if (!entriesResult.success || !countResult.success) {
      console.error('Asset history query error', {
        entriesError: entriesResult.error,
        countError: countResult.error
      });
      return res.status(500).json({
        error: 'Failed to fetch history',
        message: 'Database query failed'
      });
    }

    res.json({
      entries: entriesResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get asset history list error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset history',
      message: 'An unexpected error occurred'
    });
  }
});

// Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const assetResult = await executeQuery(
      `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email,
              d.name as department_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    if (!assetResult.success || assetResult.data.length === 0) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    res.json({
      asset: assetResult.data[0]
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset',
      message: 'An unexpected error occurred'
    });
  }
});

// Create asset
router.post('/', upload.single('image'), [
  body('name').trim().isLength({ min: 2 }),
  body('type').trim().isLength({ min: 2 }),
  body('serial_number').trim().isLength({ min: 1 }),
  body('purchase_price').isFloat({ min: 0 }),
  body('current_value').isFloat({ min: 0 }),
  body('status').isIn(['active', 'inactive', 'maintenance', 'retired']),
  body('condition').isIn(['excellent', 'good', 'fair', 'poor'])
], async (req, res) => {
  try {
    console.log('Asset creation request body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      name, type, category, manufacturer, model, serial_number,
      purchase_date, purchase_price, current_value, status, condition,
      location, assigned_to, department_id, warranty_expiry, last_maintenance, notes, custom_attributes
    } = req.body;

    // Convert date strings to proper format for database
    const formatDateForDB = (dateString) => {
      if (!dateString) return null;
      // Convert ISO string to YYYY-MM-DD format
      return new Date(dateString).toISOString().split('T')[0];
    };

    console.log('Creating asset with data:', {
      name, type, category, manufacturer, model, serial_number,
      purchase_date, purchase_price, current_value, status, condition,
      location, assigned_to, department_id, warranty_expiry, last_maintenance, notes
    });

    // Check if serial number already exists
    const existingAsset = await executeQuery(
      'SELECT id FROM assets WHERE serial_number = ?',
      [serial_number]
    );

    if (existingAsset.success && existingAsset.data.length > 0) {
      return res.status(400).json({
        error: 'Serial number already exists',
        message: 'An asset with this serial number already exists'
      });
    }

    // If assigned_to is provided, automatically set department_id to the user's department
    let finalDepartmentId = department_id;
    if (assigned_to) {
      try {
        const userDeptResult = await executeQuery(
          'SELECT department_id FROM users WHERE id = ?',
          [assigned_to]
        );
        if (userDeptResult.success && userDeptResult.data.length > 0) {
          // Assigned user's department always wins if it exists
          if (userDeptResult.data[0].department_id) {
            finalDepartmentId = userDeptResult.data[0].department_id;
          }
        }
      } catch (deptError) {
        console.error('Failed to fetch user department for automatic assignment:', deptError);
      }
    }

    // Generate UUID for the asset (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const assetId = randomUUID();

    const image_data = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;

    // Create asset
    const result = await executeQuery(
      `INSERT INTO assets (id, name, type, category, manufacturer, model, serial_number,
                          purchase_date, purchase_price, current_value, status, asset_condition,
                          location, assigned_to, department_id, warranty_expiry, last_maintenance, notes,
                          image_data, image_type, custom_attributes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetId, name, type, category || null, manufacturer || null, model || null, serial_number,
        formatDateForDB(purchase_date), purchase_price, current_value, status, condition,
        location || null, assigned_to || null, finalDepartmentId || null, formatDateForDB(warranty_expiry),
        formatDateForDB(last_maintenance), notes || null, image_data, image_type,
        custom_attributes ? JSON.stringify(custom_attributes) : null
      ]
    );

    if (!result.success) {
      console.error('Asset creation failed:', result.error);
      return res.status(500).json({
        error: 'Asset creation failed',
        message: 'Could not create asset',
        details: result.error
      });
    }

    // Get the created asset using the generated UUID
    const assetResult = await executeQuery(
      `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email,
              d.name as department_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [assetId]
    );

    const createdAsset = assetResult.data[0];

    // Log asset creation
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'CREATE',
      'asset',
      assetId,
      {
        name: createdAsset.name,
        type: createdAsset.type,
        serial_number: createdAsset.serial_number,
        status: createdAsset.status,
        department_id: createdAsset.department_id
      },
      ipAddress,
      userAgent
    );

    res.status(201).json({
      message: 'Asset created successfully',
      asset: createdAsset
    });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({
      error: 'Asset creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Update asset
router.put('/:id', upload.single('image'), [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2 }),
  body('type').optional().trim().isLength({ min: 2 }),
  body('status').optional().isIn(['active', 'inactive', 'maintenance', 'retired']),
  body('condition').optional().isIn(['excellent', 'good', 'fair', 'poor'])
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
      name, type, category, manufacturer, model, serial_number,
      purchase_date, purchase_price, current_value, status, condition,
      location, assigned_to, department_id, warranty_expiry, notes,
      assignment_notes, return_notes, return_condition, custom_attributes
    } = req.body;

    // Convert date strings to proper format for database
    const formatDateForDB = (dateString) => {
      if (!dateString) return null;
      // Convert ISO string to YYYY-MM-DD format
      return new Date(dateString).toISOString().split('T')[0];
    };

    // Check if asset exists
    const existingAsset = await executeQuery(
      'SELECT id FROM assets WHERE id = ?',
      [id]
    );

    if (!existingAsset.success || existingAsset.data.length === 0) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    // Check if serial number is unique (if changing)
    if (serial_number) {
      const serialCheck = await executeQuery(
        'SELECT id FROM assets WHERE serial_number = ? AND id != ?',
        [serial_number, id]
      );

      if (serialCheck.success && serialCheck.data.length > 0) {
        return res.status(400).json({
          error: 'Serial number already exists',
          message: 'An asset with this serial number already exists'
        });
      }
    }

    // Fetch current asset to detect assignment changes
    const currentAssetResult = await executeQuery(
      'SELECT id, name, assigned_to, department_id FROM assets WHERE id = ?',
      [id]
    );

    const previousAssignedTo = currentAssetResult.success && currentAssetResult.data.length > 0 ? currentAssetResult.data[0].assigned_to : null;
    const previousDepartmentId = currentAssetResult.success && currentAssetResult.data.length > 0 ? currentAssetResult.data[0].department_id : null;

    const normalizeNote = (value) => {
      if (value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    };
    const allowedConditions = ['excellent', 'good', 'fair', 'poor'];
    const normalizeConditionValue = (value) => {
      if (!value) return null;
      const lowered = String(value).toLowerCase();
      return allowedConditions.includes(lowered) ? lowered : null;
    };

    const assignmentNotesValue = normalizeNote(assignment_notes);
    const returnNotesValue = normalizeNote(return_notes);
    const returnConditionValue = normalizeConditionValue(return_condition);

    const assignmentChanged = assigned_to !== undefined && assigned_to !== previousAssignedTo;

    // If assigned_to is provided and has changed, automatically set department_id to the user's department
    let finalDepartmentId = department_id;
    if (assignmentChanged && assigned_to) {
      try {
        const userDeptResult = await executeQuery(
          'SELECT department_id FROM users WHERE id = ?',
          [assigned_to]
        );
        if (userDeptResult.success && userDeptResult.data.length > 0) {
          // Assigned user's department always wins if it exists
          if (userDeptResult.data[0].department_id) {
            finalDepartmentId = userDeptResult.data[0].department_id;
          }
        }
      } catch (deptError) {
        console.error('Failed to fetch user department for automatic assignment:', deptError);
      }
    }

    const departmentChanged = finalDepartmentId !== undefined && finalDepartmentId !== previousDepartmentId;

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      params.push(manufacturer);
    }
    if (model !== undefined) {
      updates.push('model = ?');
      params.push(model);
    }
    if (serial_number !== undefined) {
      updates.push('serial_number = ?');
      params.push(serial_number);
    }
    if (purchase_date !== undefined) {
      updates.push('purchase_date = ?');
      params.push(formatDateForDB(purchase_date));
    }
    if (purchase_price !== undefined) {
      updates.push('purchase_price = ?');
      params.push(purchase_price);
    }
    if (current_value !== undefined) {
      updates.push('current_value = ?');
      params.push(current_value);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (condition !== undefined) {
      updates.push('asset_condition = ?');
      params.push(condition);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    if (finalDepartmentId !== undefined) {
      updates.push('department_id = ?');
      params.push(finalDepartmentId);
    }
    if (warranty_expiry !== undefined) {
      updates.push('warranty_expiry = ?');
      params.push(formatDateForDB(warranty_expiry));
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (req.file) {
      updates.push('image_data = ?');
      params.push(req.file.buffer);
      updates.push('image_type = ?');
      params.push(req.file.mimetype);
    }
    if (custom_attributes !== undefined) {
      if (custom_attributes === null) {
          updates.push('custom_attributes = NULL');
      } else {
          updates.push('custom_attributes = ?');
          params.push(JSON.stringify(custom_attributes));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await executeQuery(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset update failed',
        message: 'Could not update asset'
      });
    }

    // Get updated asset
    const assetResult = await executeQuery(
      `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email,
              d.name as department_name
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    const updatedAsset = assetResult.data[0];

    // Persist assignment history changes
    if (assignmentChanged) {
      try {
        if (previousAssignedTo) {
          const openHistoryResult = await executeQuery(
            `SELECT id FROM asset_assignment_history
             WHERE asset_id = ? AND user_id = ? AND returned_at IS NULL
             ORDER BY assigned_at DESC
             LIMIT 1`,
            [id, previousAssignedTo]
          );

          if (openHistoryResult.success && openHistoryResult.data.length > 0) {
            const historyId = openHistoryResult.data[0].id;
            await executeQuery(
              `UPDATE asset_assignment_history
               SET returned_at = CURRENT_TIMESTAMP,
                   condition_on_return = COALESCE(?, condition_on_return),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [returnConditionValue, historyId]
            );

            if (returnNotesValue) {
              await executeQuery(
                `UPDATE asset_assignment_history
                 SET notes = CASE
                   WHEN notes IS NULL OR notes = '' THEN ?
                   ELSE CONCAT(notes, '\n', ?)
                 END,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [returnNotesValue, returnNotesValue, historyId]
              );
            }
          }
        }

        if (updatedAsset.assigned_to) {
          const { randomUUID } = await import('crypto');
          await executeQuery(
            `INSERT INTO asset_assignment_history (
               id, asset_id, user_id, assigned_by, department_id, location,
               assignment_type, assigned_at, condition_on_assign, notes
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
            [
              randomUUID(),
              id,
              updatedAsset.assigned_to,
              req.user?.id || null,
              updatedAsset.department_id || null,
              updatedAsset.location || null,
              previousAssignedTo ? 'transfer' : 'assign',
              updatedAsset.asset_condition || updatedAsset.condition || null,
              assignmentNotesValue
            ]
          );
        }
      } catch (historyError) {
        console.error('Failed to record asset assignment history:', historyError);
      }
    }

    // If assignment changed, notify assigned user and department managers
    try {
      if (assignmentChanged || departmentChanged) {
        if (updatedAsset.assigned_to) {
          await notificationService.createNotification(
            updatedAsset.assigned_to,
            'Device Assigned',
            `You have been assigned the asset ${updatedAsset.name} (SN: ${updatedAsset.serial_number}).`,
            'info'
          );

          if (updatedAsset.assigned_user_email) {
            await emailService.sendBrandedNotificationEmail(
              updatedAsset.assigned_user_email,
              'Asset Assigned',
              {
                badge: 'INFO',
                badgeColor: '#0ea5e9',
                title: 'Asset Assigned',
                greetingName: updatedAsset.assigned_user_name || '',
                message: `You have been assigned the asset "${updatedAsset.name}" (SN: ${updatedAsset.serial_number}).`,
                ctaText: 'View All Notifications',
                ctaUrl: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/notifications'
              }
            );
          }
        }

        // Notify department managers
        const deptId = updatedAsset.department_id;
        if (deptId) {
          const managersResult = await executeQuery(
            `SELECT id, name, email FROM users WHERE department_id = ? AND role IN ('admin','manager') AND is_active = TRUE`,
            [deptId]
          );
          if (managersResult.success) {
            for (const mgr of managersResult.data) {
              await notificationService.createNotification(
                mgr.id,
                'Asset Assignment Update',
                `Asset ${updatedAsset.name} has been assigned${updatedAsset.assigned_user_name ? ` to ${updatedAsset.assigned_user_name}` : ''}.`,
                'info'
              );
              if (mgr.email) {
                await emailService.sendBrandedNotificationEmail(
                  mgr.email,
                  'Asset Assignment Update',
                  {
                    badge: 'INFO',
                    badgeColor: '#0ea5e9',
                    title: 'Asset Assignment Update',
                    greetingName: mgr.name || '',
                    message: `Asset "${updatedAsset.name}" has been assigned${updatedAsset.assigned_user_name ? ` to ${updatedAsset.assigned_user_name}` : ''}.`,
                    ctaText: 'Open Assets',
                    ctaUrl: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/assets'
                  }
                );
              }
            }
          }
        }
      }
    } catch (notifyErr) {
      console.error('Failed to send asset assignment notifications:', notifyErr);
    }

    // Log asset update
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'UPDATE',
      'asset',
      id,
      {
        name: updatedAsset.name,
        changes: req.body,
        previous_assigned_to: previousAssignedTo,
        new_assigned_to: updatedAsset.assigned_to,
        previous_department: previousDepartmentId,
        new_department: updatedAsset.department_id
      },
      ipAddress,
      userAgent
    );

    res.json({
      message: 'Asset updated successfully',
      asset: updatedAsset
    });
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({
      error: 'Asset update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete asset
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if asset exists
    const existingAsset = await executeQuery(
      'SELECT id, name, serial_number, type, department_id FROM assets WHERE id = ?',
      [id]
    );

    if (!existingAsset.success || existingAsset.data.length === 0) {
      return res.status(404).json({
        error: 'Asset not found'
      });
    }

    // Check if asset has associated issues
    const issuesResult = await executeQuery(
      'SELECT COUNT(*) as count FROM issues WHERE asset_id = ?',
      [id]
    );

    if (issuesResult.data[0].count > 0) {
      return res.status(400).json({
        error: 'Cannot delete asset',
        message: 'Asset has associated issues. Please resolve them first.'
      });
    }

    const assetToDelete = existingAsset.data[0];

    // Delete asset
    const result = await executeQuery(
      'DELETE FROM assets WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Asset deletion failed',
        message: 'Could not delete asset'
      });
    }

    // Log asset deletion
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logCRUD(
      req.user?.id || null,
      'DELETE',
      'asset',
      id,
      {
        name: assetToDelete.name,
        serial_number: assetToDelete.serial_number,
        type: assetToDelete.type,
        department_id: assetToDelete.department_id
      },
      ipAddress,
      userAgent
    );

    res.json({
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({
      error: 'Asset deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

export default router;

