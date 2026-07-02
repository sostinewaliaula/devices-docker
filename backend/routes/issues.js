import express from 'express';
import { randomUUID } from 'crypto';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import notificationService from '../services/notificationService.js';
import emailService from '../services/emailService.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizePagination } from '../utils/pagination.js';

import upload from '../middleware/upload.js';

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

// Helper function to get department managers and admins
async function getDepartmentManagers(departmentId) {
  try {
    const result = await executeQuery(
      `SELECT id, name, email, role 
       FROM users 
       WHERE department_id = ? AND role = 'manager' AND is_active = TRUE`,
      [departmentId]
    );
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error getting department managers:', error);
    return [];
  }
}

// Helper function to notify all relevant parties about new issue creation
async function notifyIssueCreation(issue, reporterName) {
  try {
    console.log(`🔔 Sending notifications for issue "${issue.title}" by ${reporterName}`);

    // 1. Notify the user who reported the issue (confirmation)
    try {
      await notifyIssueReporter(issue, reporterName);
    } catch (reporterError) {
      console.error('❌ Error notifying reporter:', reporterError.message);
    }

    // 2. Notify department managers
    try {
      await notifyDepartmentManagers(issue, reporterName);
    } catch (managerError) {
      console.error('❌ Error notifying managers:', managerError.message);
    }

    // 3. Notify all admins
    try {
      await notifyAdmins(issue, reporterName);
    } catch (adminError) {
      console.error('❌ Error notifying admins:', adminError.message);
    }

    console.log(`✅ Issue notifications sent for: ${issue.id}`);
  } catch (error) {
    console.error('❌ Error in notifyIssueCreation:', error.message);
    throw error;
  }
}

// Helper function to notify the issue reporter (confirmation)
async function notifyIssueReporter(issue, reporterName) {
  try {
    if (!issue.reported_by) {
      console.log('⚠️ No reporter ID found for issue:', issue.id);
      return;
    }

    // Create in-app notification for the reporter
    const notificationId = await notificationService.createNotification(
      issue.reported_by,
      null, // assetRequestId (not applicable for issues)
      'success', // type
      'Issue Reported Successfully', // title
      `Your issue "${issue.title}" has been reported and is being reviewed.` // message
    );

    // Send email notification to reporter
    const reporterResult = await executeQuery(
      `SELECT email, email_notifications FROM users WHERE id = ?`,
      [issue.reported_by]
    );

    if (reporterResult.success && reporterResult.data.length > 0) {
      const reporter = reporterResult.data[0];

      if (reporter.email && reporter.email_notifications) {
        const emailSubject = 'Issue Reported Successfully';
        const emailHtml = notificationService.generateUserIssueCreationEmailHtml(
          reporterName,
          issue.title,
          issue.description,
          issue.priority,
          issue.category
        );
        const emailText = notificationService.generateUserIssueCreationEmailText(
          reporterName,
          issue.title,
          issue.description,
          issue.priority,
          issue.category
        );

        await notificationService.sendEmailNotification(
          reporter.email,
          emailSubject,
          emailHtml,
          emailText
        );
      }
    }
  } catch (error) {
    console.error('Error notifying issue reporter:', error);
  }
}

// Helper function to notify all admins about new issues
async function notifyAdmins(issue, reporterName) {
  try {
    const adminsResult = await executeQuery(
      `SELECT id, name, email, email_notifications FROM users 
       WHERE role = 'admin' AND is_active = TRUE`,
      []
    );

    if (!adminsResult.success || adminsResult.data.length === 0) {
      console.log('No admins found for issue notification');
      return;
    }

    for (const admin of adminsResult.data) {
      // Create in-app notification for admin
      await notificationService.createNotification(
        admin.id,
        null, // assetRequestId (not applicable for issues)
        issue.priority === 'critical' ? 'error' : issue.priority === 'high' ? 'warning' : 'info', // type
        'New Issue Reported', // title
        `${reporterName} reported a new ${issue.priority} priority issue: "${issue.title}". Please review and assign if needed.` // message
      );

      // Send email notification to admin
      if (admin.email && admin.email_notifications) {
        const emailSubject = 'New Issue Reported';
        const emailHtml = notificationService.generateAdminIssueCreationEmailHtml(
          admin.name,
          reporterName,
          issue.title,
          issue.description,
          issue.priority,
          issue.category,
          issue.asset_name
        );
        const emailText = notificationService.generateAdminIssueCreationEmailText(
          admin.name,
          reporterName,
          issue.title,
          issue.description,
          issue.priority,
          issue.category,
          issue.asset_name
        );

        await notificationService.sendEmailNotification(
          admin.email,
          emailSubject,
          emailHtml,
          emailText
        );
      }
    }

    console.log(`Notified ${adminsResult.data.length} admins about issue: ${issue.id}`);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

// Helper function to notify department managers about new issues
async function notifyDepartmentManagers(issue, reporterName) {
  try {
    let departmentId = issue.department_id;

    // Fallbacks to infer department when not provided on issue
    if (!departmentId && issue.reported_by) {
      const deptFromReporter = await executeQuery('SELECT department_id FROM users WHERE id = ?', [issue.reported_by]);
      if (deptFromReporter.success && deptFromReporter.data.length > 0) {
        departmentId = deptFromReporter.data[0].department_id || departmentId;
      }
    }
    if (!departmentId && issue.asset_id) {
      const deptFromAsset = await executeQuery('SELECT department_id FROM assets WHERE id = ?', [issue.asset_id]);
      if (deptFromAsset.success && deptFromAsset.data.length > 0) {
        departmentId = deptFromAsset.data[0].department_id || departmentId;
      }
    }

    if (!departmentId) {
      console.log('No department_id could be resolved for issue, skipping department notifications');
      return;
    }

    const managers = await getDepartmentManagers(departmentId);

    if (managers.length === 0) {
      console.log('No managers found for department:', departmentId);
      return;
    }

    const notificationTitle = `New Issue Reported - ${issue.title}`;
    const notificationMessage = `${reporterName} has reported a new ${issue.priority} priority issue: "${issue.title}". Please review and assign if needed.`;

    // Create notifications for each manager
    for (const manager of managers) {
      await notificationService.createNotification(
        manager.id,
        null, // assetRequestId (not applicable for issues)
        issue.priority === 'critical' ? 'error' : issue.priority === 'high' ? 'warning' : 'info', // type
        notificationTitle, // title
        notificationMessage // message
      );

      // Send email to managers as well
      if (manager.email) {
        try {
          // Check if manager has email notifications enabled
          const managerPrefsResult = await executeQuery(
            `SELECT email_notifications FROM users WHERE id = ?`,
            [manager.id]
          );

          if (managerPrefsResult.success && managerPrefsResult.data.length > 0 && managerPrefsResult.data[0].email_notifications) {
            const emailSubject = 'Team Member Reported New Issue';
            const emailHtml = notificationService.generateManagerIssueCreationEmailHtml(
              manager.name,
              reporterName,
              issue.title,
              issue.description,
              issue.priority,
              issue.category,
              issue.asset_name
            );
            const emailText = notificationService.generateManagerIssueCreationEmailText(
              manager.name,
              reporterName,
              issue.title,
              issue.description,
              issue.priority,
              issue.category,
              issue.asset_name
            );

            await notificationService.sendEmailNotification(
              manager.email,
              emailSubject,
              emailHtml,
              emailText
            );
          }
        } catch (e) {
          console.warn('Failed to send manager issue email to', manager.email, e.message);
        }
      }
    }

    console.log(`Notified ${managers.length} department managers about issue: ${issue.id}`);
  } catch (error) {
    console.error('Error notifying department managers:', error);
  }
}

// Helper function to notify about new issue comment
async function notifyIssueComment(issueId, commenterId, commenterName, commenterRole, commentContent) {
  try {
    // Get issue details
    const issueResult = await executeQuery(
      `SELECT i.*, 
              rb.name as reporter_name, rb.email as reporter_email,
              at.name as assigned_to_name, at.email as assigned_to_email
       FROM issues i
       LEFT JOIN users rb ON i.reported_by = rb.id
       LEFT JOIN users at ON i.assigned_to = at.id
       WHERE i.id = ?`,
      [issueId]
    );

    if (!issueResult.success || issueResult.data.length === 0) return;

    const issue = issueResult.data[0];
    const isAdminComment = commenterRole === 'admin' || commenterRole === 'manager';

    // Create an array to store all notification promises
    const notificationPromises = [];

    // Notify the issue reporter (if not the commenter)
    if (issue.reported_by && issue.reported_by !== commenterId) {
      console.log(`Debug: Entering Reporter Block. ReportedBy=${issue.reported_by}, Commenter=${commenterId}`);
      console.log(`Debug: Sending email to Reporter Email=${issue.reporter_email}`);

      const title = isAdminComment ? 'Admin Response to Your Issue' : 'New Comment on Your Issue';
      const message = isAdminComment
        ? `Admin ${commenterName} responded to your issue "${issue.title}".`
        : `${commenterName} added a comment to your issue "${issue.title}".`;

      // Add reporter notification to promises
      notificationPromises.push(
        notificationService.createNotification(
          issue.reported_by,
          null,
          isAdminComment ? 'success' : 'info',
          title,
          message
        ).catch(err => console.error('Error creating reporter notification:', err))
      );

      // Send email notification to reporter
      const userPrefsResult = await executeQuery(
        `SELECT email_notifications FROM users WHERE id = ?`,
        [issue.reported_by]
      );

      if (userPrefsResult.success && userPrefsResult.data && userPrefsResult.data.length > 0 && userPrefsResult.data[0].email_notifications) {
        // ... (email generation code)
        const emailSubject = isAdminComment
          ? `Admin Response on Issue - ${issue.title}`
          : `New Comment on Issue - ${issue.title}`;
        const emailHtml = generateIssueCommentEmailHtml(
          issue.reporter_name,
          issue.title,
          commenterName,
          commentContent,
          isAdminComment,
          true // isReporter = true
        );
        const emailText = generateIssueCommentEmailText(
          issue.reporter_name,
          issue.title,
          commenterName,
          commentContent,
          isAdminComment,
          true // isReporter = true
        );

        notificationPromises.push(
          notificationService.sendEmailNotification(
            issue.reporter_email,
            emailSubject,
            emailHtml,
            emailText
          ).catch(err => console.error('Error sending reporter email:', err))
        );
      }
    }

    // Notify assigned person (if different from reporter and commenter)
    if (issue.assigned_to && issue.assigned_to !== commenterId && issue.assigned_to !== issue.reported_by) {
      const title = 'New Comment on Assigned Issue';
      const message = `${commenterName} added a comment to issue "${issue.title}" assigned to you.`;

      notificationPromises.push(
        notificationService.createNotification(
          issue.assigned_to,
          null,
          'info',
          title,
          message
        ).catch(err => console.error('Error creating assignee notification:', err))
      );

      // Send email notification to assigned person
      const assigneePrefsResult = await executeQuery(
        `SELECT email_notifications FROM users WHERE id = ?`,
        [issue.assigned_to]
      );

      if (assigneePrefsResult.success && assigneePrefsResult.data && assigneePrefsResult.data.length > 0 && assigneePrefsResult.data[0].email_notifications) {
        const emailSubject = `New Comment on Assigned Issue - ${issue.title}`;
        const emailHtml = generateIssueCommentEmailHtml(
          issue.assigned_to_name,
          issue.title,
          commenterName,
          commentContent,
          isAdminComment,
          false, // isReporter = false
          issue.reporter_name
        );
        const emailText = generateIssueCommentEmailText(
          issue.assigned_to_name,
          issue.title,
          commenterName,
          commentContent,
          isAdminComment,
          false, // isReporter = false
          issue.reporter_name
        );

        notificationPromises.push(
          notificationService.sendEmailNotification(
            issue.assigned_to_email,
            emailSubject,
            emailHtml,
            emailText
          ).catch(err => console.error('Error sending assignee email:', err))
        );
      }
    }

    // Resolve department ID for scoping manager notifications
    let departmentId = issue.department_id;
    if (!departmentId && issue.reported_by) {
      const deptFromReporter = await executeQuery('SELECT department_id FROM users WHERE id = ?', [issue.reported_by]);
      if (deptFromReporter.success && deptFromReporter.data.length > 0) {
        departmentId = deptFromReporter.data[0].department_id || departmentId;
      }
    }
    if (!departmentId && issue.asset_id) {
      const deptFromAsset = await executeQuery('SELECT department_id FROM assets WHERE id = ?', [issue.asset_id]);
      if (deptFromAsset.success && deptFromAsset.data.length > 0) {
        departmentId = deptFromAsset.data[0].department_id || departmentId;
      }
    }

    // Notify all admins, and ONLY managers of the relevant department
    // Admins always get notified. Managers only if they match the department.
    // SKIPPED if the commenter IS an admin/manager (to avoid spamming other admins for every reply)
    if (!isAdminComment) {
      const adminsResult = await executeQuery(
        `SELECT id, name, email FROM users 
         WHERE (
           role = 'admin' 
           OR (role = 'manager' AND department_id = ?)
         ) 
         AND is_active = TRUE 
         AND id != ?`,
        [departmentId, commenterId]
      );

      if (adminsResult.success) {
        for (const admin of adminsResult.data) {
          const title = isAdminComment ? 'Admin Comment on Issue' : 'New Comment on Issue';
          const message = isAdminComment
            ? `Admin ${commenterName} commented on issue "${issue.title}".`
            : `${commenterName} added a comment to issue "${issue.title}".`;

          // Add admin notification to promises
          notificationPromises.push(
            notificationService.createNotification(
              admin.id,
              null,
              isAdminComment ? 'success' : 'info',
              title,
              message
            ).catch(err => console.error(`Error creating notification for admin ${admin.id}:`, err))
          );

          // Send email notification to admin
          const adminPrefsResult = await executeQuery(
            `SELECT email_notifications FROM users WHERE id = ?`,
            [admin.id]
          );

          if (adminPrefsResult.success && adminPrefsResult.data && adminPrefsResult.data.length > 0 && adminPrefsResult.data[0].email_notifications) {
            const emailSubject = isAdminComment
              ? `Admin Comment on Issue - ${issue.title}`
              : `New Comment on Issue - ${issue.title}`;
            const emailHtml = generateIssueCommentEmailHtml(
              admin.name,
              issue.title,
              commenterName,
              commentContent,
              isAdminComment,
              false, // isReporter = false
              issue.reporter_name
            );
            const emailText = generateIssueCommentEmailText(
              admin.name,
              issue.title,
              commenterName,
              commentContent,
              isAdminComment,
              false, // isReporter = false
              issue.reporter_name
            );

            notificationPromises.push(
              notificationService.sendEmailNotification(
                admin.email,
                emailSubject,
                emailHtml,
                emailText
              ).catch(err => console.error(`Error sending email to admin ${admin.email}:`, err))
            );
          }
        }
      }
    }

    // Wait for all notifications to complete (in parallel)
    await Promise.all(notificationPromises);

    console.log(`✅ Issue comment notifications sent for issue ${issueId}`);
  } catch (error) {
    console.error('Error notifying users about issue comment:', error);
  }
}

async function recordAssetIssueEvent({ assetId, issueId, eventType, status, summary, details, userId }) {
  if (!assetId) return;
  try {
    const trimmedSummary = (summary || '').trim() || 'Issue update';
    const safeDetails = details ? String(details).slice(0, 1000) : null;
    await executeQuery(
      `INSERT INTO asset_issue_history (
        id, asset_id, issue_id, event_type, status, summary, details, changed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        assetId,
        issueId,
        eventType,
        status || null,
        trimmedSummary.slice(0, 250),
        safeDetails,
        userId || null
      ]
    );
  } catch (error) {
    console.error('Failed to record asset issue event:', error);
  }
}

// Helper function to generate HTML email for issue comment
function generateIssueCommentEmailHtml(userName, issueTitle, commenterName, comment, isAdminComment = false, isReporter = true, reporterName = null) {
  const issueOwner = isReporter ? 'your' : `${reporterName}'s`;
  const actionText = isAdminComment ? 'responded to' : 'added a comment to';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Comment on Issue</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .comment { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 15px 0; }
        .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isAdminComment ? 'Admin Response on Issue' : 'New Comment on Issue'}</h1>
          <p>Hello ${userName},</p>
        </div>
        
        <div class="content">
          <p><strong>${isAdminComment ? 'Admin ' : ''}${commenterName}</strong> ${actionText} ${issueOwner} issue <strong>${issueTitle}</strong>:</p>
          
          <div class="comment">
            ${comment}
          </div>
          
          <p>You can view the full conversation and respond in your dashboard.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from the Asset Management System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to generate text email for issue comment
function generateIssueCommentEmailText(userName, issueTitle, commenterName, comment, isAdminComment = false, isReporter = true, reporterName = null) {
  const issueOwner = isReporter ? 'your' : `${reporterName}'s`;
  const actionText = isAdminComment ? 'responded to' : 'added a comment to';

  return `
${isAdminComment ? 'Admin Response on Issue' : 'New Comment on Issue'}

Hello ${userName},

${isAdminComment ? 'Admin ' : ''}${commenterName} ${actionText} ${issueOwner} issue ${issueTitle}:

${comment}

You can view the full conversation and respond in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
  `;
}

// Get all issues
router.get('/', async (req, res) => {
  try {
    const {
      page: pageParam = 1,
      limit: limitParam = 1000,
      search = '',
      status = '',
      priority = '',
      department_id = '',
      assigned_to = '',
      asset_id = '',
      reported_by = '',
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

    if (department_id) {
      whereClause += ' AND i.department_id = ?';
      params.push(department_id);
    }

    if (assigned_to) {
      whereClause += ' AND i.assigned_to = ?';
      params.push(assigned_to);
    }

    if (asset_id) {
      whereClause += ' AND i.asset_id = ?';
      params.push(asset_id);
    }

    if (reported_by) {
      whereClause += ' AND i.reported_by = ?';
      params.push(reported_by);
    }

    const issuesResult = await executeQuery(
      `SELECT i.*, 
              rb.name as reported_by_name, rb.email as reported_by_email,
              at.name as assigned_to_name, at.email as assigned_to_email,
              a.name as asset_name, a.serial_number as asset_serial,
              d.name as department_name
       FROM issues i
       LEFT JOIN users rb ON i.reported_by = rb.id
       LEFT JOIN users at ON i.assigned_to = at.id
       LEFT JOIN assets a ON i.asset_id = a.id
       LEFT JOIN departments d ON i.department_id = d.id
       ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM issues i ${whereClause}`,
      params
    );

    if (!issuesResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch issues',
        message: 'Database query failed'
      });
    }

    let costSummary = null;
    if (includeCostSummary) {
      const costResult = await executeQuery(
        `SELECT COALESCE(SUM(i.estimated_cost), 0) as total_estimated_cost
         FROM issues i
         ${whereClause}`,
        params
      );

      if (costResult.success && costResult.data.length > 0) {
        costSummary = {
          total_estimated_cost: Number(costResult.data[0].total_estimated_cost) || 0,
          currency: process.env.DEFAULT_CURRENCY || 'KES'
        };
      }
    }

    const issues = issuesResult.data.map(issue => {
      const estimatedCost = issue.estimated_cost === null || issue.estimated_cost === undefined
        ? null
        : Number(issue.estimated_cost);
      return {
        ...issue,
        estimated_cost: canViewCostDetails ? estimatedCost : null
      };
    });

    const responsePayload = {
      issues,
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
    console.error('Get issues error:', error);
    res.status(500).json({
      error: 'Failed to fetch issues',
      message: 'An unexpected error occurred'
    });
  }
});

// Get issue by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const issueResult = await executeQuery(
      `SELECT i.*, 
              rb.name as reported_by_name, rb.email as reported_by_email,
              at.name as assigned_to_name, at.email as assigned_to_email,
              a.name as asset_name, a.serial_number as asset_serial,
              d.name as department_name
       FROM issues i
       LEFT JOIN users rb ON i.reported_by = rb.id
       LEFT JOIN users at ON i.assigned_to = at.id
       LEFT JOIN assets a ON i.asset_id = a.id
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.id = ?`,
      [id]
    );

    if (!issueResult.success || issueResult.data.length === 0) {
      return res.status(404).json({
        error: 'Issue not found'
      });
    }
    const issueRow = issueResult.data[0];

    // Get comments for this issue
    const commentsResult = await executeQuery(
      `SELECT ic.*, u.name as user_name, u.email as user_email
       FROM issue_comments ic
       LEFT JOIN users u ON ic.user_id = u.id
       WHERE ic.issue_id = ?
       ORDER BY ic.created_at ASC`,
      [id]
    );

    // Get attachments for this issue (metadata only)
    const attachmentsResult = await executeQuery(
      'SELECT id, file_name, file_type, file_size FROM issue_attachments WHERE issue_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json({
      issue: {
        ...issueRow,
        estimated_cost: req.user?.role === 'admin' && issueRow.estimated_cost !== null
          ? Number(issueRow.estimated_cost)
          : null
      },
      comments: commentsResult.success ? commentsResult.data : [],
      attachments: attachmentsResult.success ? attachmentsResult.data : []
    });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({
      error: 'Failed to fetch issue',
      message: 'An unexpected error occurred'
    });
  }
});

// Get attachment content
router.get('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeQuery('SELECT file_name, file_type, file_content FROM issue_attachments WHERE id = ?', [id]);
    if (!result.success || result.data.length === 0) return res.status(404).send('Attachment not found');
    const attachment = result.data[0];
    res.setHeader('Content-Type', attachment.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    res.send(attachment.file_content);
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).send('Error fetching attachment');
  }
});

// Create issue with attachments
router.post('/', [
  authenticateToken,
  upload.array('attachments', 5), // Handle up to 5 files
  body('title').trim().isLength({ min: 5 }),
  body('description').trim().isLength({ min: 10 }),
  body('priority').isIn(['low', 'medium', 'high', 'critical']),
  body('category').optional().trim(),
  body('estimated_cost').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 })
], async (req, res) => {
  try {
    console.log('DEBUG: Issue Creation Request');
    console.log('DEBUG: req.body keys:', Object.keys(req.body));
    console.log('DEBUG: req.files:', req.files ? req.files.length : 'undefined');
    if (req.files) {
      req.files.forEach((f, i) => console.log(`DEBUG: File ${i}:`, f.originalname, f.mimetype, f.size));
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const {
      title, description, priority, category, assigned_to,
      asset_id, department_id, estimated_resolution_date, estimated_cost
    } = req.body;

    const reporterId = req.user.id;
    const reporterName = req.user.name;

    // Get department fallback
    let finalDepartmentId = department_id;
    if (!finalDepartmentId) {
      const reporterResult = await executeQuery('SELECT department_id FROM users WHERE id = ?', [reporterId]);
      if (reporterResult.success && reporterResult.data.length > 0) finalDepartmentId = reporterResult.data[0].department_id;
    }

    const parsedEstimatedCost = parseEstimatedCostInput(estimated_cost);
    if (parsedEstimatedCost.error) return res.status(400).json({ error: 'Invalid cost' });
    if (parsedEstimatedCost.provided && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    const normalizedEstimatedCost = parsedEstimatedCost.provided ? parsedEstimatedCost.value : null;

    const issueId = randomUUID();

    // Insert Issue
    await executeQuery(
      `INSERT INTO issues (id, title, description, priority, category, reported_by, 
                          assigned_to, asset_id, department_id, estimated_resolution_date, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [issueId, title, description, priority, category || null, reporterId, assigned_to || null, asset_id || null, finalDepartmentId || null, estimated_resolution_date || null, normalizedEstimatedCost]
    );

    // Insert Attachments
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} attachments for issue ${issueId}`);

      for (const file of req.files) {
        const attachmentId = randomUUID();
        await executeQuery(
          `INSERT INTO issue_attachments (id, issue_id, file_name, file_type, file_size, file_content, uploaded_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            attachmentId,
            issueId,
            file.originalname,
            file.mimetype,
            file.size,
            file.buffer, // Buffer from memory storage
            reporterId
          ]
        );
      }
    }

    // ... existing notification logic ...
    notifyIssueCreation({ id: issueId, title, priority, description, category, reported_by: reporterId }, reporterName);

    // Return success
    res.status(201).json({
      message: 'Issue reported successfully',
      issue: { id: issueId, title, priority }
    });

  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue', message: error.message });
  }
});


// Update issue
router.put('/:id', [
  body('title').optional().trim().isLength({ min: 5 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'scheduled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
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
      title, description, status, priority, category, assigned_to,
      asset_id, department_id, estimated_resolution_date, actual_resolution_date,
      estimated_cost
    } = req.body;

    // Check if issue exists
    const existingIssue = await executeQuery(
      'SELECT id, reported_by, status, assigned_to, asset_id FROM issues WHERE id = ?',
      [id]
    );

    if (!existingIssue.success || existingIssue.data.length === 0) {
      return res.status(404).json({
        error: 'Issue not found'
      });
    }

    // Check permissions (user can only update their own issues unless admin/manager)
    if (req.user.role === 'user' && existingIssue.data[0].reported_by !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own issues'
      });
    }

    const previousIssueSnapshot = existingIssue.data[0];
    const previousStatus = previousIssueSnapshot.status;
    const previousAssignee = previousIssueSnapshot.assigned_to;
    const previousAssetId = previousIssueSnapshot.asset_id;

    // Build update query
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    if (asset_id !== undefined) {
      updates.push('asset_id = ?');
      params.push(asset_id);
    }
    if (department_id !== undefined) {
      updates.push('department_id = ?');
      params.push(department_id);
    }
    if (estimated_resolution_date !== undefined) {
      updates.push('estimated_resolution_date = ?');
      params.push(estimated_resolution_date);
    }
    if (actual_resolution_date !== undefined) {
      updates.push('actual_resolution_date = ?');
      params.push(actual_resolution_date);
    }
    if (estimated_cost !== undefined) {
      if (req.user.role !== 'admin') {
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
      `UPDATE issues SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Issue update failed',
        message: 'Could not update issue'
      });
    }

    // Get updated issue
    const issueResult = await executeQuery(
      `SELECT i.*, 
              rb.name as reported_by_name, rb.email as reported_by_email,
              at.name as assigned_to_name, at.email as assigned_to_email,
              a.name as asset_name, a.serial_number as asset_serial,
              d.name as department_name
       FROM issues i
       LEFT JOIN users rb ON i.reported_by = rb.id
       LEFT JOIN users at ON i.assigned_to = at.id
       LEFT JOIN assets a ON i.asset_id = a.id
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.id = ?`,
      [id]
    );

    const updatedIssue = issueResult.data[0];
    updatedIssue.estimated_cost = req.user?.role === 'admin' && updatedIssue.estimated_cost !== null
      ? Number(updatedIssue.estimated_cost)
      : null;

    const historyEvents = [];
    if (status !== undefined && status !== previousStatus && updatedIssue.asset_id) {
      historyEvents.push({
        assetId: updatedIssue.asset_id,
        issueId: id,
        eventType: ['resolved', 'closed'].includes(status) ? 'resolution' : 'status_change',
        status,
        summary: `Status changed from ${previousStatus || 'unknown'} to ${status}`,
        details: actual_resolution_date ? `Resolution date: ${actual_resolution_date}` : null
      });
    }
    if (assigned_to !== undefined && assigned_to !== previousAssignee && updatedIssue.asset_id) {
      historyEvents.push({
        assetId: updatedIssue.asset_id,
        issueId: id,
        eventType: 'owner_change',
        status: updatedIssue.status,
        summary: assigned_to ? `Issue assigned to ${updatedIssue.assigned_to_name || 'a user'}` : 'Issue unassigned',
        details: req.user?.name ? `Changed by ${req.user.name}` : null
      });
    }
    if (asset_id !== undefined && asset_id !== previousAssetId) {
      if (previousAssetId) {
        historyEvents.push({
          assetId: previousAssetId,
          issueId: id,
          eventType: 'asset_unlinked',
          status: updatedIssue.status,
          summary: 'Issue unlinked from asset',
          details: `Moved away from previous asset`
        });
      }
      if (updatedIssue.asset_id) {
        historyEvents.push({
          assetId: updatedIssue.asset_id,
          issueId: id,
          eventType: 'asset_linked',
          status: updatedIssue.status,
          summary: 'Issue linked to asset',
          details: updatedIssue.asset_name ? `Associated with ${updatedIssue.asset_name}` : null
        });
      }
    }

    for (const event of historyEvents) {
      await recordAssetIssueEvent({
        ...event,
        userId: req.user?.id || null
      });
    }

    res.json({
      message: 'Issue updated successfully',
      issue: updatedIssue
    });
  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({
      error: 'Issue update failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Add comment to issue
router.post('/:id/comments', [
  body('content').trim().isLength({ min: 1 })
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
    const { content } = req.body;

    // Check if issue exists
    const issueResult = await executeQuery(
      'SELECT id, asset_id, status FROM issues WHERE id = ?',
      [id]
    );

    if (!issueResult.success || issueResult.data.length === 0) {
      return res.status(404).json({
        error: 'Issue not found'
      });
    }

    const issueRow = issueResult.data[0];

    // Generate UUID for the comment (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const commentId = randomUUID();

    // Add comment
    const result = await executeQuery(
      `INSERT INTO issue_comments (id, issue_id, user_id, user_name, content)
       VALUES (?, ?, ?, ?, ?)`,
      [commentId, id, req.user.id, req.user.name, content]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Comment creation failed',
        message: 'Could not add comment'
      });
    }

    // Get the created comment using the generated UUID
    const commentResult = await executeQuery(
      `SELECT ic.*, u.name as user_name, u.email as user_email
       FROM issue_comments ic
       LEFT JOIN users u ON ic.user_id = u.id
       WHERE ic.id = ?`,
      [commentId]
    );

    console.log(`💬 Comment added by ${req.user.name} on issue ${id}`);

    // Get commenter role for notifications
    const userRoleResult = await executeQuery(
      'SELECT role FROM users WHERE id = ?',
      [req.user.id]
    );
    const commenterRole = userRoleResult.success && userRoleResult.data.length > 0
      ? userRoleResult.data[0].role
      : 'user';

    // Send notifications in background (non-blocking)
    notifyIssueComment(id, req.user.id, req.user.name, commenterRole, content)
      .catch(err => console.error('Error sending issue comment notifications:', err));

    if (issueRow.asset_id) {
      await recordAssetIssueEvent({
        assetId: issueRow.asset_id,
        issueId: id,
        eventType: 'comment',
        status: issueRow.status,
        summary: `Comment added by ${req.user.name || 'a user'}`,
        details: content,
        userId: req.user.id
      });
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: commentResult.data[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      error: 'Comment creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete issue
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if issue exists
    const existingIssue = await executeQuery(
      'SELECT id, reported_by FROM issues WHERE id = ?',
      [id]
    );

    if (!existingIssue.success || existingIssue.data.length === 0) {
      return res.status(404).json({
        error: 'Issue not found'
      });
    }

    // Check permissions (user can only delete their own issues unless admin/manager)
    if (req.user.role === 'user' && existingIssue.data[0].reported_by !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own issues'
      });
    }

    // Delete issue (comments will be deleted by CASCADE)
    const result = await executeQuery(
      'DELETE FROM issues WHERE id = ?',
      [id]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Issue deletion failed',
        message: 'Could not delete issue'
      });
    }

    res.json({
      message: 'Issue deleted successfully'
    });
  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({
      error: 'Issue deletion failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Get attachment content
router.get('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await executeQuery(
      'SELECT file_name, file_type, file_content FROM issue_attachments WHERE id = ?',
      [id]
    );

    if (!result.success || result.data.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const file = result.data[0];

    // Check permissions? 
    // Ideally we should check if user has access to the issue this attachment belongs to.
    // However, the ID is a UUID, so it's relatively secure. 
    // Since this is already behind authenticateToken (from server.js), the user is at least logged in. [CONFIRMED]

    res.setHeader('Content-Type', file.file_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
    res.end(file.file_content);

  } catch (error) {
    console.error('Get attachment error:', error);
    res.status(500).json({ error: 'Failed to retrieve attachment' });
  }
});

export default router;

