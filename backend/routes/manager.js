import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireManager } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import { wrapEmail, badge, callout, button, avatar, LIGHT } from '../utils/emailTheme.js';

const router = express.Router();

// Get department manager dashboard data
router.get('/dashboard', authenticateToken, requireManager, async (req, res) => {
  try {
    const { user } = req;
    
    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    // Get department info
    const departmentResult = await executeQuery(
      'SELECT * FROM departments WHERE id = ?',
      [user.department_id]
    );

    if (!departmentResult.success || departmentResult.data.length === 0) {
      return res.status(404).json({
        error: 'Department not found'
      });
    }

    const department = departmentResult.data[0];

    // Get team members count
    const teamMembersResult = await executeQuery(
      'SELECT COUNT(*) as count FROM users WHERE department_id = ? AND is_active = 1',
      [user.department_id]
    );

    // Get assets count
    const assetsResult = await executeQuery(
      'SELECT COUNT(*) as count FROM assets WHERE department_id = ?',
      [user.department_id]
    );

    // Get open issues count
    const issuesResult = await executeQuery(
      `SELECT COUNT(*) as count FROM issues i
       JOIN users u ON i.reported_by = u.id
       WHERE u.department_id = ? AND i.status = 'Open'`,
      [user.department_id]
    );

    // Get pending asset requests count
    const requestsResult = await executeQuery(
      `SELECT COUNT(*) as count FROM asset_requests ar
       JOIN users u ON ar.user_id = u.id
       WHERE u.department_id = ? AND ar.status = 'pending'`,
      [user.department_id]
    );

    res.json({
      department,
      stats: {
        teamMembers: teamMembersResult.data[0]?.count || 0,
        assets: assetsResult.data[0]?.count || 0,
        openIssues: issuesResult.data[0]?.count || 0,
        pendingRequests: requestsResult.data[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: 'An unexpected error occurred'
    });
  }
});

// Get department team members
router.get('/team', authenticateToken, requireManager, async (req, res) => {
  try {
    const { user } = req;
    const { search = '', role = '' } = req.query;

    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    let whereClause = 'WHERE u.department_id = ? AND u.is_active = 1';
    const params = [user.department_id];

    if (search) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.position LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }

    const result = await executeQuery(
      `SELECT u.id, u.name, u.email, u.role, u.position, u.phone, 
              u.is_active, u.last_login, u.created_at
       FROM users u
       ${whereClause}
       ORDER BY u.name ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to fetch team members',
        message: 'Database query failed'
      });
    }

    res.json({
      teamMembers: result.data
    });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({
      error: 'Failed to fetch team members',
      message: 'An unexpected error occurred'
    });
  }
});

// Get department issues
router.get('/issues', authenticateToken, requireManager, async (req, res) => {
  try {
    const { user } = req;
    const { search = '', status = '', priority = '' } = req.query;

    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    let whereClause = `WHERE (u.department_id = ? OR a.department_id = ?)`;
    const params = [user.department_id, user.department_id];

    if (search) {
      whereClause += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (priority) {
      whereClause += ' AND i.priority = ?';
      params.push(priority);
    }

    const result = await executeQuery(
      `SELECT i.*, 
              u.name as reporter_name, u.email as reporter_email,
              a.name as asset_name, a.serial_number as asset_serial
       FROM issues i
       LEFT JOIN users u ON i.reported_by = u.id
       LEFT JOIN assets a ON i.asset_id = a.id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to fetch department issues',
        message: 'Database query failed'
      });
    }

    res.json({
      issues: result.data
    });
  } catch (error) {
    console.error('Get department issues error:', error);
    res.status(500).json({
      error: 'Failed to fetch department issues',
      message: 'An unexpected error occurred'
    });
  }
});

// Get department assets
router.get('/assets', authenticateToken, requireManager, async (req, res) => {
  try {
    const { user } = req;
    const { search = '', status = '', type = '' } = req.query;

    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    let whereClause = 'WHERE a.department_id = ?';
    const params = [user.department_id];

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

    const result = await executeQuery(
      `SELECT a.*, 
              u.name as assigned_user_name, u.email as assigned_user_email
       FROM assets a
       LEFT JOIN users u ON a.assigned_to = u.id
       ${whereClause}
       ORDER BY a.created_at DESC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to fetch department assets',
        message: 'Database query failed'
      });
    }

    res.json({
      assets: result.data
    });
  } catch (error) {
    console.error('Get department assets error:', error);
    res.status(500).json({
      error: 'Failed to fetch department assets',
      message: 'An unexpected error occurred'
    });
  }
});

// Get department asset requests
router.get('/asset-requests', authenticateToken, requireManager, async (req, res) => {
  try {
    const { user } = req;
    const { search = '', status = '', priority = '' } = req.query;

    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    let whereClause = `WHERE u.department_id = ?`;
    const params = [user.department_id];

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

    const result = await executeQuery(
      `SELECT ar.*, 
              u.name as user_name, u.email as user_email,
              approver.name as approved_by_name
       FROM asset_requests ar
       LEFT JOIN users u ON ar.user_id = u.id
       LEFT JOIN users approver ON ar.approved_by = approver.id
       ${whereClause}
       ORDER BY ar.created_at DESC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to fetch department asset requests',
        message: 'Database query failed'
      });
    }

    res.json({
      asset_requests: result.data
    });
  } catch (error) {
    console.error('Get department asset requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch department asset requests',
      message: 'An unexpected error occurred'
    });
  }
});

// Send message to team member
router.post('/send-message', [
  authenticateToken,
  requireManager,
  body('receiver_id').trim().isLength({ min: 1 }),
  body('subject').trim().isLength({ min: 1 }),
  body('content').trim().isLength({ min: 1 }),
  body('priority').optional().isIn(['Low', 'Medium', 'High'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user } = req;
    const { receiver_id, subject, content, priority = 'Medium' } = req.body;

    // Verify receiver is in the same department
    const receiverResult = await executeQuery(
      'SELECT id, name, email FROM users WHERE id = ? AND department_id = ?',
      [receiver_id, user.department_id]
    );

    if (!receiverResult.success || receiverResult.data.length === 0) {
      return res.status(400).json({
        error: 'Invalid receiver',
        message: 'Receiver must be a member of your department'
      });
    }

    const receiver = receiverResult.data[0];

    // Create notification for the receiver
    await notificationService.createNotification(
      receiver_id,
      null, // assetRequestId - not applicable for messages
      'info',
      `Message from ${user.name}`,
      subject
    );

    // Send email to the receiver
    try {
      const priorityKind = priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success';
      const priorityIcon = priority === 'High' ? '🔴' : priority === 'Medium' ? '🟡' : '🟢';
      const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      const htmlContent = wrapEmail({
        title: '💬 New Message',
        preheader: `New message from ${user.name}: ${subject}`,
        bodyHtml: `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
            <td valign="middle" style="padding-right:14px;">${avatar(user.name.charAt(0).toUpperCase())}</td>
            <td valign="middle">
              <div class="em-h" style="font-size:18px;font-weight:700;color:${LIGHT.heading};">${user.name}</div>
              <div class="em-muted" style="font-size:14px;color:${LIGHT.muted};">Your Manager</div>
            </td>
          </tr></table>
          <div style="margin:0 0 8px;">${badge(`${priorityIcon} ${priority} Priority`, priorityKind)}</div>
          <h2 class="em-h" style="margin:8px 0 12px;font-size:20px;color:${LIGHT.heading};">${subject}</h2>
          ${callout(`<div style="white-space:pre-wrap;">${content}</div>`)}
          ${button('View &amp; Respond in System', `${appUrl}/notifications`, { align: 'center' })}`,
        footerHtml: `<p style="margin:0 0 6px;">This message was sent through the Asset Management System</p>
      <p style="margin:0;">Please log in to respond to this message</p>`,
      });
      
      const textContent = `Dear ${receiver.name},\n\nYou have received a new message from your manager ${user.name}:\n\nSubject: ${subject}\n\nMessage:\n${content}\n\nPriority: ${priority}\n\nPlease log in to the asset management system to view and respond to this message.\n\nRegards,\nAsset Management System`;
      
      await emailService.sendNotificationEmail(
        receiver.email,
        `💬 ${subject} - Message from ${user.name}`,
        textContent,
        htmlContent
      );
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails, just log it
    }

    res.json({
      message: 'Message sent successfully',
      receiver: {
        id: receiver.id,
        name: receiver.name,
        email: receiver.email
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: 'An unexpected error occurred'
    });
  }
});

// Send announcement to all team members
router.post('/send-announcement', [
  authenticateToken,
  requireManager,
  body('subject').trim().isLength({ min: 1 }),
  body('content').trim().isLength({ min: 1 }),
  body('priority').optional().isIn(['Low', 'Medium', 'High'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { user } = req;
    const { subject, content, priority = 'Medium' } = req.body;

    if (!user.department_id) {
      return res.status(400).json({
        error: 'No department assigned',
        message: 'User is not assigned to any department'
      });
    }

    // Get all team members
    const teamMembersResult = await executeQuery(
      'SELECT id, name, email FROM users WHERE department_id = ? AND is_active = 1',
      [user.department_id]
    );

    if (!teamMembersResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch team members',
        message: 'Database query failed'
      });
    }

    const teamMembers = teamMembersResult.data;

    // Send notification and email to all team members
    for (const member of teamMembers) {
      // Create notification
      await notificationService.createNotification(
        member.id,
        null, // assetRequestId - not applicable for announcements
        'info',
        `Announcement from ${user.name}`,
        subject
      );

      // Send email
      try {
        const priorityKind = priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'success';
        const priorityIcon = priority === 'High' ? '🔴' : priority === 'Medium' ? '🟡' : '🟢';
        const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

        const htmlContent = wrapEmail({
          title: '📢 Department Announcement',
          preheader: `Department announcement from ${user.name}: ${subject}`,
          bodyHtml: `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
              <td valign="middle" style="padding-right:14px;">${avatar(user.name.charAt(0).toUpperCase())}</td>
              <td valign="middle">
                <div class="em-h" style="font-size:18px;font-weight:700;color:${LIGHT.heading};">${user.name}</div>
                <div class="em-muted" style="font-size:14px;color:${LIGHT.muted};">Department Manager</div>
                <div style="margin-top:8px;">${badge('Department Announcement', 'info')}</div>
              </td>
            </tr></table>
            <div style="margin:0 0 8px;">${badge(`${priorityIcon} ${priority} Priority`, priorityKind)}</div>
            <h2 class="em-h" style="margin:8px 0 12px;font-size:20px;color:${LIGHT.heading};">${subject}</h2>
            ${callout(`<div style="white-space:pre-wrap;">${content}</div>`)}
            ${button('View Announcement in System', `${appUrl}/notifications`, { align: 'center' })}`,
          footerHtml: `<p style="margin:0 0 6px;">This announcement was sent to all department members</p>
      <p style="margin:0;">Please log in to view and respond to this announcement</p>`,
        });
        
        const textContent = `Dear ${member.name},\n\nYou have received a new department announcement from your manager ${user.name}:\n\nSubject: ${subject}\n\nAnnouncement:\n${content}\n\nPriority: ${priority}\n\nPlease log in to the asset management system to view this announcement.\n\nRegards,\nAsset Management System`;
        
        await emailService.sendNotificationEmail(
          member.email,
          `📢 ${subject} - Department Announcement`,
          textContent,
          htmlContent
        );
      } catch (emailError) {
        console.error(`Error sending email to ${member.email}:`, emailError);
        // Don't fail the request if email fails, just log it
      }
    }

    res.json({
      message: 'Announcement sent successfully',
      recipients: teamMembers.length,
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        email: member.email
      }))
    });
  } catch (error) {
    console.error('Send announcement error:', error);
    res.status(500).json({
      error: 'Failed to send announcement',
      message: 'An unexpected error occurred'
    });
  }
});

export default router;
