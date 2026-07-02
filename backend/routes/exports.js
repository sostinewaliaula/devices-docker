import express from 'express';
import { executeQuery } from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Helper function to convert array of objects to CSV
function convertToCSV(data, headers) {
  if (!data || data.length === 0) {
    return headers.join(',') + '\n';
  }

  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value).replace(/"/g, '""');
      return /[,"\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
    }).join(',');
  });

  return csvHeaders + '\n' + csvRows.join('\n');
}

// Helper function to format date for CSV
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US') + ' ' + d.toLocaleTimeString('en-US');
}

// Export team members (for managers)
router.get('/team-members', [authenticateToken, authorizeRoles('manager', 'admin')], async (req, res) => {
  try {
    const departmentId = req.user.department_id;

    if (!departmentId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must be assigned to a department'
      });
    }

    // Fetch team members
    const query = req.user.role === 'admin'
      ? `SELECT u.id, u.name, u.email, u.phone, u.position, u.role, 
                d.name as department_name, u.is_active,
                DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         ORDER BY u.name ASC`
      : `SELECT u.id, u.name, u.email, u.phone, u.position, u.role,
                d.name as department_name, u.is_active,
                DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.department_id = ?
         ORDER BY u.name ASC`;

    const params = req.user.role === 'admin' ? [] : [departmentId];
    const result = await executeQuery(query, params);

    if (!result.success) {
      throw new Error('Failed to fetch team members');
    }

    // Format data for CSV
    const formattedData = result.data.map(member => ({
      name: member.name,
      email: member.email,
      phone: member.phone || 'N/A',
      position: member.position || 'N/A',
      role: member.role,
      department: member.department_name || 'Unassigned',
      status: member.is_active ? 'Active' : 'Inactive',
      joined_date: member.created_at
    }));

    const headers = ['name', 'email', 'phone', 'position', 'role', 'department', 'status', 'joined_date'];
    const csv = convertToCSV(formattedData, headers);

    // Set headers for CSV download
    const filename = `team-members-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export team members error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Export department issues (for managers)
router.get('/department-issues', [authenticateToken, authorizeRoles('manager', 'admin')], async (req, res) => {
  try {
    const departmentId = req.user.department_id;

    if (!departmentId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must be assigned to a department'
      });
    }

    // Fetch department issues
    const query = req.user.role === 'admin'
      ? `SELECT i.id, i.title, i.description, i.priority, i.status, i.category,
                rb.name as reported_by_name, at.name as assigned_to_name,
                a.name as asset_name, a.serial_number as asset_serial,
                d.name as department_name,
                DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(i.resolved_at, '%Y-%m-%d %H:%i:%s') as resolved_at,
                DATE_FORMAT(i.estimated_resolution_date, '%Y-%m-%d') as estimated_resolution_date
         FROM issues i
         LEFT JOIN users rb ON i.reported_by = rb.id
         LEFT JOIN users at ON i.assigned_to = at.id
         LEFT JOIN assets a ON i.asset_id = a.id
         LEFT JOIN departments d ON i.department_id = d.id
         ORDER BY i.created_at DESC`
      : `SELECT i.id, i.title, i.description, i.priority, i.status, i.category,
                rb.name as reported_by_name, at.name as assigned_to_name,
                a.name as asset_name, a.serial_number as asset_serial,
                d.name as department_name,
                DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                DATE_FORMAT(i.resolved_at, '%Y-%m-%d %H:%i:%s') as resolved_at,
                DATE_FORMAT(i.estimated_resolution_date, '%Y-%m-%d') as estimated_resolution_date
         FROM issues i
         LEFT JOIN users rb ON i.reported_by = rb.id
         LEFT JOIN users at ON i.assigned_to = at.id
         LEFT JOIN assets a ON i.asset_id = a.id
         LEFT JOIN departments d ON i.department_id = d.id
         WHERE i.department_id = ?
         ORDER BY i.created_at DESC`;

    const params = req.user.role === 'admin' ? [] : [departmentId];
    const result = await executeQuery(query, params);

    if (!result.success) {
      throw new Error('Failed to fetch department issues');
    }

    // Format data for CSV
    const formattedData = result.data.map(issue => ({
      title: issue.title,
      description: issue.description || 'N/A',
      priority: issue.priority,
      status: issue.status,
      category: issue.category || 'N/A',
      reported_by: issue.reported_by_name || 'Unknown',
      assigned_to: issue.assigned_to_name || 'Unassigned',
      asset: issue.asset_name || 'N/A',
      asset_serial: issue.asset_serial || 'N/A',
      department: issue.department_name || 'N/A',
      created_at: issue.created_at,
      estimated_resolution: issue.estimated_resolution_date || 'N/A',
      resolved_at: issue.resolved_at || 'Not resolved'
    }));

    const headers = ['title', 'description', 'priority', 'status', 'category', 'reported_by', 'assigned_to', 'asset', 'asset_serial', 'department', 'created_at', 'estimated_resolution', 'resolved_at'];
    const csv = convertToCSV(formattedData, headers);

    // Set headers for CSV download
    const filename = `department-issues-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export department issues error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Export department assets (for managers)
router.get('/department-assets', [authenticateToken, authorizeRoles('manager', 'admin')], async (req, res) => {
  try {
    const departmentId = req.user.department_id;

    if (!departmentId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must be assigned to a department'
      });
    }

    // Fetch department assets
    const query = req.user.role === 'admin'
      ? `SELECT a.id, a.name, a.type, a.category, a.manufacturer, a.model, a.serial_number,
                a.purchase_date, a.purchase_price, a.current_value, a.status, a.asset_condition,
                a.location, u.name as assigned_user_name, d.name as department_name,
                a.warranty_expiry, a.last_maintenance, a.notes,
                DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM assets a
         LEFT JOIN users u ON a.assigned_to = u.id
         LEFT JOIN departments d ON a.department_id = d.id
         ORDER BY a.created_at DESC`
      : `SELECT a.id, a.name, a.type, a.category, a.manufacturer, a.model, a.serial_number,
                a.purchase_date, a.purchase_price, a.current_value, a.status, a.asset_condition,
                a.location, u.name as assigned_user_name, d.name as department_name,
                a.warranty_expiry, a.last_maintenance, a.notes,
                DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM assets a
         LEFT JOIN users u ON a.assigned_to = u.id
         LEFT JOIN departments d ON a.department_id = d.id
         WHERE a.department_id = ?
         ORDER BY a.created_at DESC`;

    const params = req.user.role === 'admin' ? [] : [departmentId];
    const result = await executeQuery(query, params);

    if (!result.success) {
      throw new Error('Failed to fetch department assets');
    }

    // Format data for CSV
    const formattedData = result.data.map(asset => ({
      name: asset.name,
      type: asset.type,
      category: asset.category || 'N/A',
      manufacturer: asset.manufacturer || 'N/A',
      model: asset.model || 'N/A',
      serial_number: asset.serial_number,
      purchase_date: asset.purchase_date || 'N/A',
      purchase_price: asset.purchase_price || '0',
      current_value: asset.current_value || '0',
      status: asset.status,
      condition: asset.asset_condition,
      location: asset.location || 'N/A',
      assigned_to: asset.assigned_user_name || 'Unassigned',
      department: asset.department_name || 'N/A',
      warranty_expiry: asset.warranty_expiry || 'N/A',
      last_maintenance: asset.last_maintenance || 'N/A',
      notes: asset.notes || 'N/A',
      created_at: asset.created_at
    }));

    const headers = ['name', 'type', 'category', 'manufacturer', 'model', 'serial_number', 'purchase_date', 'purchase_price', 'current_value', 'status', 'condition', 'location', 'assigned_to', 'department', 'warranty_expiry', 'last_maintenance', 'notes', 'created_at'];
    const csv = convertToCSV(formattedData, headers);

    // Set headers for CSV download
    const filename = `department-assets-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export department assets error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Export asset requests (for managers)
router.get('/asset-requests', [authenticateToken, authorizeRoles('manager', 'admin')], async (req, res) => {
  try {
    const departmentId = req.user.department_id;

    if (!departmentId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You must be assigned to a department'
      });
    }

    // Fetch asset requests
    const query = req.user.role === 'admin'
      ? `SELECT ar.id, ar.asset_name, ar.asset_type, ar.category, ar.reason, ar.priority,
                ar.status, ar.notes, u.name as user_name, u.email as user_email,
                d.name as department_name, ar.response_notes,
                DATE_FORMAT(ar.requested_date, '%Y-%m-%d') as requested_date,
                DATE_FORMAT(ar.reviewed_date, '%Y-%m-%d %H:%i:%s') as reviewed_date,
                DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM asset_requests ar
         JOIN users u ON ar.user_id = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         ORDER BY ar.created_at DESC`
      : `SELECT ar.id, ar.asset_name, ar.asset_type, ar.category, ar.reason, ar.priority,
                ar.status, ar.notes, u.name as user_name, u.email as user_email,
                d.name as department_name, ar.response_notes,
                DATE_FORMAT(ar.requested_date, '%Y-%m-%d') as requested_date,
                DATE_FORMAT(ar.reviewed_date, '%Y-%m-%d %H:%i:%s') as reviewed_date,
                DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') as created_at
         FROM asset_requests ar
         JOIN users u ON ar.user_id = u.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.department_id = ?
         ORDER BY ar.created_at DESC`;

    const params = req.user.role === 'admin' ? [] : [departmentId];
    const result = await executeQuery(query, params);

    if (!result.success) {
      throw new Error('Failed to fetch asset requests');
    }

    // Format data for CSV
    const formattedData = result.data.map(request => ({
      asset_name: request.asset_name,
      asset_type: request.asset_type,
      category: request.category || 'N/A',
      reason: request.reason || 'N/A',
      priority: request.priority,
      status: request.status,
      requester: request.user_name,
      requester_email: request.user_email,
      department: request.department_name || 'N/A',
      requested_date: request.requested_date,
      reviewed_date: request.reviewed_date || 'Not reviewed',
      notes: request.notes || 'N/A',
      response_notes: request.response_notes || 'N/A',
      created_at: request.created_at
    }));

    const headers = ['asset_name', 'asset_type', 'category', 'reason', 'priority', 'status', 'requester', 'requester_email', 'department', 'requested_date', 'reviewed_date', 'notes', 'response_notes', 'created_at'];
    const csv = convertToCSV(formattedData, headers);

    // Set headers for CSV download
    const filename = `asset-requests-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    console.error('Export asset requests error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'An unexpected error occurred'
    });
  }
});

export default router;



