import emailService from './emailService.js';
import { executeQuery } from '../config/database.js';
import { sanitizePagination } from '../utils/pagination.js';
import {
  wrapEmail, paragraph, muted, heading, link, button, badge, detailTable, callout, panel,
  sectionTitle, td, dataTable, statCards, kindFor, LIGHT
} from '../utils/emailTheme.js';

// Status / priority -> palette badge kinds (solid company colours, see utils/emailTheme.js)
const STATUS_KIND = { submitted: 'info', pending: 'warning', approved: 'success', rejected: 'danger', fulfilled: 'success' };
const STATUS_TEXT = {
  'submitted': 'Submitted',
  'pending': 'Pending Review',
  'approved': 'Approved',
  'rejected': 'Rejected',
  'fulfilled': 'Fulfilled'
};
const PRIORITY_KIND = { critical: 'danger', high: 'warning', medium: 'info', low: 'success' };
const PRIORITY_TEXT = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

const systemFooter = (system = 'Asset Management System') =>
  `<p style="margin:0 0 6px;">This is an automated notification from the ${system}.</p>
      <p style="margin:0;">Please do not reply to this email.</p>`;

class NotificationService {
  constructor() {
    // Transporter is now handled by emailService
  }

  // Create in-app notification
  async createNotification(userId, assetRequestId, type, title, message) {
    try {
      // Generate UUID for the notification (since MySQL insertId doesn't work with UUID primary keys)
      const { randomUUID } = await import('crypto');
      const notificationId = randomUUID();

      const result = await executeQuery(
        `INSERT INTO notifications (id, user_id, type, title, message) 
         VALUES (?, ?, ?, ?, ?)`,
        [notificationId, userId, type, title, message]
      );

      if (!result.success) {
        console.error('Failed to insert notification:', result.error);
        throw new Error('Failed to insert notification: ' + result.error);
      }

      if (result.data.affectedRows === 0) {
        console.error('No rows affected - notification not inserted');
        throw new Error('Failed to insert notification - no rows affected');
      }

      return notificationId;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, limitInput = 50, offsetInput = 0) {
    try {
      const { limit, offset } = sanitizePagination(1, limitInput, {
        defaultLimit: 50,
        maxLimit: 1000,
        offsetInput
      });

      const result = await executeQuery(
        `SELECT n.*, NULL as asset_name, NULL as request_status
         FROM notifications n
         WHERE n.user_id = ?
         ORDER BY n.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [userId]
      );

      if (!result.success) {
        console.error('Database query failed:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      await executeQuery(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      await executeQuery(
        `UPDATE notifications 
         SET is_read = TRUE 
         WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Get unread notification count
  async getUnreadCount(userId) {
    try {
      const result = await executeQuery(
        `SELECT COUNT(*) as count 
         FROM notifications 
         WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      );

      if (!result.success) {
        console.error('Database query failed:', result.error);
        return 0;
      }

      return result.data && result.data[0] ? result.data[0].count : 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Send email notification (supports optional attachments)
  async sendEmailNotification(userEmail, subject, htmlContent, textContent, attachments = []) {
    try {
      // Delegate to emailService which handles DB configuration
      return await emailService.sendNotificationEmail(userEmail, subject, htmlContent);
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  // Notify status change
  async notifyStatusChange(assetRequestId, oldStatus, newStatus, adminName) {
    try {
      // Get asset request details
      const result = await executeQuery(
        `SELECT ar.*, u.name as user_name, u.email as user_email
         FROM asset_requests ar
         JOIN users u ON ar.user_id = u.id
         WHERE ar.id = ?`,
        [assetRequestId]
      );

      if (result.data.length === 0) return;

      const request = result.data[0];
      const userEmail = request.user_email;
      const userName = request.user_name;
      const assetName = request.asset_name;

      // Create notification message
      const statusMessages = {
        'submitted': 'has been submitted',
        'pending': 'is pending review',
        'approved': 'has been approved',
        'rejected': 'has been rejected',
        'fulfilled': 'has been fulfilled'
      };

      const title = `Asset Request ${statusMessages[newStatus]}`;
      const message = `Your request for "${assetName}" ${statusMessages[newStatus]}${adminName ? ` by ${adminName}` : ''}.`;

      // Create in-app notification for user
      await this.createNotification(
        request.user_id,
        assetRequestId,
        'info',
        title,
        message
      );

      // Get all users to notify in parallel (user, managers, admins)
      const [userPrefsResult, managersResult, adminsResult] = await Promise.all([
        executeQuery(`SELECT email_notifications FROM users WHERE id = ?`, [request.user_id]),
        executeQuery(
          `SELECT id, name, email, email_notifications FROM users 
           WHERE department_id = (SELECT department_id FROM users WHERE id = ?) 
           AND role = 'manager' AND is_active = TRUE`,
          [request.user_id]
        ),
        executeQuery(
          `SELECT id, name, email, email_notifications FROM users 
           WHERE role = 'admin' AND is_active = TRUE`,
          []
        )
      ]);

      // Send email to user if enabled
      if (userPrefsResult.success && userPrefsResult.data && userPrefsResult.data.length > 0 && userPrefsResult.data[0].email_notifications) {
        const emailSubject = `Your Asset Request ${statusMessages[newStatus]} - ${assetName}`;
        const emailHtml = this.generateUserStatusChangeEmailHtml(
          userName,
          assetName,
          newStatus,
          adminName,
          request.reason
        );
        const emailText = this.generateUserStatusChangeEmailText(
          userName,
          assetName,
          newStatus,
          adminName,
          request.reason
        );

        this.sendEmailNotification(userEmail, emailSubject, emailHtml, emailText).catch(err =>
          console.error('Failed to send email to user:', err)
        );
      }

      // Notify managers in the same department
      if (managersResult.success) {
        const managerNotifications = managersResult.data.map(manager => {
          const managerTitle = `Asset Request ${statusMessages[newStatus]}`;
          const managerMessage = `${userName}'s request for "${assetName}" ${statusMessages[newStatus]}${adminName ? ` by ${adminName}` : ''}.`;

          return this.createNotification(
            manager.id,
            assetRequestId,
            'info',
            managerTitle,
            managerMessage
          ).then(() => {
            // Send email if enabled
            if (manager.email_notifications) {
              const emailSubject = `Team Member's Asset Request ${statusMessages[newStatus]} - ${assetName}`;
              const emailHtml = this.generateManagerStatusChangeEmailHtml(
                manager.name,
                userName,
                assetName,
                newStatus,
                adminName,
                request.reason
              );
              const emailText = this.generateManagerStatusChangeEmailText(
                manager.name,
                userName,
                assetName,
                newStatus,
                adminName,
                request.reason
              );

              return this.sendEmailNotification(manager.email, emailSubject, emailHtml, emailText);
            }
          });
        });

        Promise.all(managerNotifications).catch(err =>
          console.error('Failed to notify managers:', err)
        );
      }

      // Notify all admins (in-app notifications only, no emails)
      if (adminsResult.success) {
        const adminNotifications = adminsResult.data.map(admin => {
          const adminTitle = `Asset Request ${statusMessages[newStatus]}`;
          const adminMessage = `${userName}'s request for "${assetName}" ${statusMessages[newStatus]}${adminName ? ` by ${adminName}` : ''}.`;

          // Only create in-app notification, no email
          return this.createNotification(
            admin.id,
            assetRequestId,
            'info',
            adminTitle,
            adminMessage
          );
        });

        Promise.all(adminNotifications).catch(err =>
          console.error('Failed to notify admins:', err)
        );
      }
    } catch (error) {
      console.error('Error notifying status change:', error);
      throw error;
    }
  }


  // Generate HTML email for status change
  generateStatusChangeEmailHtml(userName, assetName, newStatus, adminName, reason) {
    return wrapEmail({
      title: 'Device Request Update',
      preheader: `Your request for ${assetName} is now ${STATUS_TEXT[newStatus]}`,
      bodyHtml: [
        paragraph(`Hello ${userName},`),
        paragraph('Your device request has been updated:'),
        heading('Request Details'),
        detailTable([
          ['Asset:', assetName],
          ['Status:', badge(STATUS_TEXT[newStatus], STATUS_KIND[newStatus])],
          adminName && ['Updated by:', adminName],
        ]),
        reason ? heading('Original Request', 3) + callout(reason) : '',
        paragraph('You can view the full details and add comments in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for status change
  generateStatusChangeEmailText(userName, assetName, newStatus, adminName, reason) {
    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
Asset Request Update

Hello ${userName},

Your asset request has been updated:

Request Details:
- Asset: ${assetName}
- Status: ${statusText[newStatus]}
${adminName ? `- Updated by: ${adminName}` : ''}

${reason ? `
Original Request:
${reason}
` : ''}

You can view the full details and add comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for comment
  generateCommentEmailHtml(userName, assetName, commenterName, comment) {
    return wrapEmail({
      title: 'New Comment on Asset Request',
      preheader: `${commenterName} commented on your request for ${assetName}`,
      bodyHtml: [
        paragraph(`Hello ${userName},`),
        paragraph(`<strong>${commenterName}</strong> added a comment to your request for <strong>${assetName}</strong>:`),
        callout(comment),
        paragraph('You can view the full conversation and add your own comments in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for comment
  generateCommentEmailText(userName, assetName, commenterName, comment) {
    return `
New Comment on Asset Request

Hello ${userName},

${commenterName} added a comment to your request for ${assetName}:

${comment}

You can view the full conversation and add your own comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for user status change
  generateUserStatusChangeEmailHtml(userName, assetName, newStatus, adminName, reason) {
    return wrapEmail({
      title: 'Your Asset Request Update',
      preheader: `Your request for ${assetName} is now ${STATUS_TEXT[newStatus]}`,
      bodyHtml: [
        paragraph(`Hello ${userName},`),
        paragraph('Your asset request has been updated:'),
        heading('Request Details'),
        detailTable([
          ['Asset:', assetName],
          ['Status:', badge(STATUS_TEXT[newStatus], STATUS_KIND[newStatus])],
          adminName && ['Updated by:', adminName],
        ]),
        reason ? heading('Your Original Request', 3) + callout(reason) : '',
        paragraph('You can view the full details and add comments in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for user status change
  generateUserStatusChangeEmailText(userName, assetName, newStatus, adminName, reason) {
    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
Your Asset Request Update

Hello ${userName},

Your asset request has been updated:

Request Details:
- Asset: ${assetName}
- Status: ${statusText[newStatus]}
${adminName ? `- Updated by: ${adminName}` : ''}

${reason ? `
Your Original Request:
${reason}
` : ''}

You can view the full details and add comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for manager status change
  generateManagerStatusChangeEmailHtml(managerName, requesterName, assetName, newStatus, adminName, reason) {
    return wrapEmail({
      title: "Team Member's Asset Request Update",
      preheader: `${requesterName}'s request for ${assetName} is now ${STATUS_TEXT[newStatus]}`,
      bodyHtml: [
        paragraph(`Hello ${managerName},`),
        paragraph("A team member's asset request has been updated:"),
        heading('Request Details'),
        detailTable([
          ['Requester:', requesterName],
          ['Asset:', assetName],
          ['Status:', badge(STATUS_TEXT[newStatus], STATUS_KIND[newStatus])],
          adminName && ['Updated by:', adminName],
        ]),
        reason ? heading('Original Request', 3) + callout(reason) : '',
        paragraph('You can view the full details and add comments in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for manager status change
  generateManagerStatusChangeEmailText(managerName, requesterName, assetName, newStatus, adminName, reason) {
    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
Team Member's Asset Request Update

Hello ${managerName},

A team member's asset request has been updated:

Request Details:
- Requester: ${requesterName}
- Asset: ${assetName}
- Status: ${statusText[newStatus]}
${adminName ? `- Updated by: ${adminName}` : ''}

${reason ? `
Original Request:
${reason}
` : ''}

You can view the full details and add comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for admin status change
  generateAdminStatusChangeEmailHtml(adminName, requesterName, assetName, newStatus, updatedBy, reason) {
    return wrapEmail({
      title: 'Asset Request Update',
      preheader: `${requesterName}'s request for ${assetName} is now ${STATUS_TEXT[newStatus]}`,
      bodyHtml: [
        paragraph(`Hello ${adminName},`),
        paragraph('An asset request has been updated:'),
        heading('Request Details'),
        detailTable([
          ['Requester:', requesterName],
          ['Asset:', assetName],
          ['Status:', badge(STATUS_TEXT[newStatus], STATUS_KIND[newStatus])],
          updatedBy && ['Updated by:', updatedBy],
        ]),
        reason ? heading('Original Request', 3) + callout(reason) : '',
        paragraph('You can view the full details and add comments in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for admin status change
  generateAdminStatusChangeEmailText(adminName, requesterName, assetName, newStatus, updatedBy, reason) {
    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
Asset Request Update

Hello ${adminName},

An asset request has been updated:

Request Details:
- Requester: ${requesterName}
- Asset: ${assetName}
- Status: ${statusText[newStatus]}
${updatedBy ? `- Updated by: ${updatedBy}` : ''}

${reason ? `
Original Request:
${reason}
` : ''}

You can view the full details and add comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for admin new request
  generateAdminNewRequestEmailHtml(adminName, requesterName, assetName, assetType, reason) {
    return wrapEmail({
      title: 'New Asset Request Submitted',
      preheader: `${requesterName} requested ${assetName}`,
      bodyHtml: [
        paragraph(`Hello ${adminName},`),
        paragraph('A new asset request has been submitted and requires your attention:'),
        heading('Request Details'),
        detailTable([
          ['Requester:', requesterName],
          ['Asset:', assetName],
          ['Type:', assetType],
          ['Status:', badge('Submitted', 'info')],
        ]),
        reason ? heading('Request Details', 3) + callout(reason) : '',
        paragraph('Please review and take appropriate action on this request in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for admin new request
  generateAdminNewRequestEmailText(adminName, requesterName, assetName, assetType, reason) {
    return `
New Asset Request Submitted

Hello ${adminName},

A new asset request has been submitted and requires your attention:

Request Details:
- Requester: ${requesterName}
- Asset: ${assetName}
- Type: ${assetType}
- Status: Submitted

${reason ? `
Request Details:
${reason}
` : ''}

Please review and take appropriate action on this request in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for user new request
  generateUserNewRequestEmailHtml(userName, assetName, assetType, reason) {
    return wrapEmail({
      title: 'Your Device Request Has Been Submitted',
      preheader: `Your request for ${assetName} is under review`,
      bodyHtml: [
        paragraph(`Hello ${userName},`),
        paragraph('Your device request has been successfully submitted and is now under review:'),
        heading('Request Details'),
        detailTable([
          ['Device:', assetName],
          ['Type:', assetType],
          ['Status:', badge('Submitted', 'info')],
        ]),
        reason ? heading('Your Request Details', 3) + callout(reason) : '',
        paragraph('You will be notified once your request is reviewed and a decision is made. You can track the progress in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for user new request
  generateUserNewRequestEmailText(userName, assetName, assetType, reason) {
    return `
Your Device Request Has Been Submitted

Hello ${userName},

Your device request has been successfully submitted and is now under review:

Request Details:
- Device: ${assetName}
- Type: ${assetType}
- Status: Submitted

${reason ? `
Your Request Details:
${reason}
` : ''}

You will be notified once your request is reviewed and a decision is made. You can track the progress in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for manager new request
  generateManagerNewRequestEmailHtml(managerName, requesterName, assetName, assetType, reason) {
    return wrapEmail({
      title: 'Team Member Submitted New Device Request',
      preheader: `${requesterName} requested ${assetName}`,
      bodyHtml: [
        paragraph(`Hello ${managerName},`),
        paragraph('A team member from your department has submitted a new device request:'),
        heading('Request Details'),
        detailTable([
          ['Requester:', requesterName],
          ['Device:', assetName],
          ['Type:', assetType],
          ['Status:', badge('Submitted', 'info')],
        ]),
        reason ? heading('Request Details', 3) + callout(reason) : '',
        paragraph('You can review this request and provide input in your dashboard. The request will be processed by the admin team.'),
      ].join(''),
      footerHtml: systemFooter('Devices Management System'),
    });
  }

  // Generate text email for manager new request
  generateManagerNewRequestEmailText(managerName, requesterName, assetName, assetType, reason) {
    return `
Team Member Submitted New Asset Request

Hello ${managerName},

A team member from your department has submitted a new asset request:

Request Details:
- Requester: ${requesterName}
- Asset: ${assetName}
- Type: ${assetType}
- Status: Submitted

${reason ? `
Request Details:
${reason}
` : ''}

You can review this request and provide input in your dashboard. The request will be processed by the admin team.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for user issue creation
  generateUserIssueCreationEmailHtml(userName, title, description, priority, category) {
    return wrapEmail({
      title: 'Issue Reported Successfully',
      preheader: `Your issue "${title}" is being reviewed`,
      bodyHtml: [
        paragraph(`Hello ${userName},`),
        paragraph('Your issue has been successfully reported and is being reviewed:'),
        heading('Issue Details'),
        detailTable([
          ['Title:', title],
          ['Priority:', badge(PRIORITY_TEXT[priority], PRIORITY_KIND[priority])],
          category && ['Category:', category],
        ]),
        heading('Description', 3),
        callout(description),
        paragraph('You will be notified once your issue is reviewed and assigned. You can track the progress in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for user issue creation
  generateUserIssueCreationEmailText(userName, title, description, priority, category) {
    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
Issue Reported Successfully

Hello ${userName},

Your issue has been successfully reported and is being reviewed:

Issue Details:
- Title: ${title}
- Priority: ${priorityText[priority]}
${category ? `- Category: ${category}` : ''}

Description:
${description}

You will be notified once your issue is reviewed and assigned. You can track the progress in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for manager issue creation
  generateManagerIssueCreationEmailHtml(managerName, reporterName, title, description, priority, category, assetName) {
    return wrapEmail({
      title: 'Team Member Reported New Issue',
      preheader: `${reporterName} reported: ${title}`,
      bodyHtml: [
        paragraph(`Hello ${managerName},`),
        paragraph('A team member from your department has reported a new issue:'),
        heading('Issue Details'),
        detailTable([
          ['Reporter:', reporterName],
          ['Title:', title],
          ['Priority:', badge(PRIORITY_TEXT[priority], PRIORITY_KIND[priority])],
          category && ['Category:', category],
          assetName && ['Asset:', assetName],
        ]),
        heading('Description', 3),
        callout(description),
        paragraph('Please review this issue and provide input in your dashboard. The issue will be processed by the admin team.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for manager issue creation
  generateManagerIssueCreationEmailText(managerName, reporterName, title, description, priority, category, assetName) {
    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
Team Member Reported New Issue

Hello ${managerName},

A team member from your department has reported a new issue:

Issue Details:
- Reporter: ${reporterName}
- Title: ${title}
- Priority: ${priorityText[priority]}
${category ? `- Category: ${category}` : ''}
${assetName ? `- Asset: ${assetName}` : ''}

Description:
${description}

Please review this issue and provide input in your dashboard. The issue will be processed by the admin team.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Generate HTML email for admin issue creation
  generateAdminIssueCreationEmailHtml(adminName, reporterName, title, description, priority, category, assetName) {
    return wrapEmail({
      title: 'New Issue Reported',
      preheader: `${reporterName} reported: ${title}`,
      bodyHtml: [
        paragraph(`Hello ${adminName},`),
        paragraph('A new issue has been reported and requires your attention:'),
        heading('Issue Details'),
        detailTable([
          ['Reporter:', reporterName],
          ['Title:', title],
          ['Priority:', badge(PRIORITY_TEXT[priority], PRIORITY_KIND[priority])],
          category && ['Category:', category],
          assetName && ['Asset:', assetName],
        ]),
        heading('Description', 3),
        callout(description),
        paragraph('Please review and take appropriate action on this issue in your dashboard.'),
      ].join(''),
      footerHtml: systemFooter(),
    });
  }

  // Generate text email for admin issue creation
  generateAdminIssueCreationEmailText(adminName, reporterName, title, description, priority, category, assetName) {
    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
New Issue Reported

Hello ${adminName},

A new issue has been reported and requires your attention:

Issue Details:
- Reporter: ${reporterName}
- Title: ${title}
- Priority: ${priorityText[priority]}
${category ? `- Category: ${category}` : ''}
${assetName ? `- Asset: ${assetName}` : ''}

Description:
${description}

Please review and take appropriate action on this issue in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }

  // Notify user creation (send welcome email)
  async notifyUserCreation(userId, userEmail, userName, temporaryPassword) {
    try {
      console.log('Creating notification for user:', userEmail);

      // Create in-app notification
      const title = 'Welcome to Caava Group Assets Management';
      const message = `Your account has been created. You can now log in with your credentials. Please change your password after logging in for the first time.`;

      await this.createNotification(
        userId,
        null,
        'info',
        title,
        message
      );
      console.log('In-app notification created successfully');

      // Send welcome email
      console.log('Sending welcome email to:', userEmail);
      const emailSubject = 'Welcome to Caava Group Assets Management System';
      const emailHtml = this.generateWelcomeEmailHtml(userName, userEmail, temporaryPassword);
      const emailText = this.generateWelcomeEmailText(userName, userEmail, temporaryPassword);

      const emailResult = await this.sendEmailNotification(userEmail, emailSubject, emailHtml, emailText);
      console.log('Email sent, result:', emailResult);

      return { success: true, message: 'User creation notifications sent' };
    } catch (error) {
      console.error('Error in notifyUserCreation:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate HTML email for welcome/user creation
  generateWelcomeEmailHtml(userName, userEmail, temporaryPassword) {
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return wrapEmail({
      title: 'Caava Group',
      subtitle: 'Assets Management System',
      preheader: 'Your account has been created',
      bodyHtml: [
        heading(`Welcome ${userName}! 🎉`, 1),
        paragraph('Your account has been successfully created. You can now access the Caava Group Assets Management System to manage your assets and track your requests.'),
        panel(`<div class="em-h" style="margin:0 0 8px;font-weight:700;color:${LIGHT.heading};">🔗 Access Your Account</div>${link(loginUrl, loginUrl)}`),
        callout(`<div style="margin:0 0 8px;font-weight:700;">📧 Your Login Credentials:</div>
          <div style="margin:6px 0;"><strong>Email:</strong> ${userEmail}</div>
          <div style="margin:6px 0;"><strong>Temporary Password:</strong> ${temporaryPassword}</div>`),
        `<div class="em-h" style="margin:20px 0 8px;font-weight:700;color:${LIGHT.heading};">🚀 Next Steps:</div>`,
        paragraph('1. Click the login URL above or visit the site', { margin: '0 0 6px' }),
        paragraph('2. Log in with your email and temporary password', { margin: '0 0 6px' }),
        paragraph('3. Change your password in the security settings', { margin: '0 0 6px' }),
        paragraph('4. Complete your profile information', { margin: '0 0 14px' }),
        paragraph("If you have any questions or need assistance, please don't hesitate to contact your administrator or the support team."),
        button('Login to Your Account', loginUrl, { align: 'center' }),
      ].join(''),
      footerHtml: `<p style="margin:0 0 6px;">This is an automated notification from the Caava Group Assets Management System.</p>
      <p style="margin:0;">© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>`,
    });
  }

  // Generate text email for welcome/user creation
  generateWelcomeEmailText(userName, userEmail, temporaryPassword) {
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return `
Welcome to Caava Group Devices Management System!

Hello ${userName},

Your account has been successfully created. You can now access the Caava Group Assets Management System to manage your assets and track your requests.

ACCESS YOUR ACCOUNT:
${loginUrl}

YOUR LOGIN CREDENTIALS:
Email: ${userEmail}
Temporary Password: ${temporaryPassword}

NEXT STEPS:
1. Visit the login URL above
2. Log in with your email and temporary password
3. Change your password in the security settings
4. Complete your profile information

If you have any questions or need assistance, please don't hesitate to contact your administrator or the support team.

This is an automated notification from the Caava Group Assets Management System.
© ${new Date().getFullYear()} Caava Group. All rights reserved.
    `;
  }

  // Generate HTML email for admin new user registration notification
  generateNewUserRegistrationEmailHtml(adminName, userName, userEmail, position, department, phone) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userManagementUrl = `${frontendUrl}/admin/users`;

    return wrapEmail({
      title: 'New User Registration',
      preheader: `${userName} has registered`,
      bodyHtml: [
        paragraph(`Hello ${adminName},`),
        callout('<strong>Action Required</strong><br>A new user has successfully registered and created their account.'),
        panel(`<div class="em-h" style="margin:0 0 4px;font-size:18px;font-weight:700;color:${LIGHT.heading};">User Details</div>` + detailTable([
          ['Name:', userName],
          ['Email:', userEmail],
          ['Position:', position],
          ['Department:', department],
          ['Phone:', phone],
        ])),
        paragraph('The user has been automatically assigned the "user" role and can now access the system. You can review and manage this user in the User Management section.'),
        button('View User Management', userManagementUrl, { align: 'center' }),
      ].join(''),
      footerHtml: `<p style="margin:0 0 6px;">This is an automated notification from the Caava Group Assets Management System.</p>
      <p style="margin:0;">© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>`,
    });
  }

  // Generate text email for admin new user registration notification
  generateNewUserRegistrationEmailText(adminName, userName, userEmail, position, department, phone) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const userManagementUrl = `${frontendUrl}/admin/users`;

    return `
New User Registration

Hello ${adminName},

⚠️ ACTION REQUIRED: A new user has successfully registered and created their account.

USER DETAILS:
- Name: ${userName}
- Email: ${userEmail}
- Position: ${position}
- Department: ${department}
- Phone: ${phone}

The user has been automatically assigned the "user" role and can now access the system. 
You can review and manage this user in the User Management section.

View User Management: ${userManagementUrl}

This is an automated notification from the Caava Group Assets Management System.
© ${new Date().getFullYear()} Caava Group. All rights reserved.
    `;
  }

  // Get unresolved issues (open, in_progress, scheduled - not resolved/closed)
  async getUnresolvedIssues() {
    try {
      const result = await executeQuery(
        `SELECT i.*, 
                u.name as reported_by_name, u.email as reported_by_email,
                a.name as asset_name,
                d.name as department_name,
                assignee.name as assigned_to_name
         FROM issues i
         LEFT JOIN users u ON i.reported_by = u.id
         LEFT JOIN assets a ON i.asset_id = a.id
         LEFT JOIN departments d ON i.department_id = d.id
         LEFT JOIN users assignee ON i.assigned_to = assignee.id
         WHERE i.status IN ('open', 'in_progress', 'scheduled')
         ORDER BY 
           CASE i.priority
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           i.created_at ASC`,
        []
      );

      if (!result.success) {
        console.error('Failed to fetch unresolved issues:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching unresolved issues:', error);
      return [];
    }
  }

  // Get pending asset requests (not approved/rejected/fulfilled)
  async getPendingAssetRequests() {
    try {
      const result = await executeQuery(
        `SELECT ar.*, 
                u.name as user_name, u.email as user_email,
                approver.name as approved_by_name
         FROM asset_requests ar
         LEFT JOIN users u ON ar.user_id = u.id
         LEFT JOIN users approver ON ar.approved_by = approver.id
         WHERE ar.status = 'pending'
         ORDER BY 
           CASE ar.priority
             WHEN 'urgent' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             WHEN 'low' THEN 4
           END,
           ar.created_at ASC`,
        []
      );

      if (!result.success) {
        console.error('Failed to fetch pending asset requests:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching pending asset requests:', error);
      return [];
    }
  }

  // Get all admin users
  async getAdminUsers() {
    try {
      const result = await executeQuery(
        `SELECT id, name, email, email_notifications 
         FROM users 
         WHERE role = 'admin' AND is_active = TRUE`,
        []
      );

      if (!result.success) {
        console.error('Failed to fetch admin users:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  // Send weekly summary to admins
  async sendWeeklySummaryToAdmins() {
    try {
      console.log('📧 Starting weekly summary notification process...');

      // Get unresolved issues and pending requests
      const unresolvedIssues = await this.getUnresolvedIssues();
      const pendingRequests = await this.getPendingAssetRequests();
      const admins = await this.getAdminUsers();

      if (admins.length === 0) {
        console.log('⚠️ No admin users found. Skipping weekly summary.');
        return { success: false, message: 'No admin users found' };
      }

      console.log(`📊 Found ${unresolvedIssues.length} unresolved issues and ${pendingRequests.length} pending asset requests`);
      console.log(`👥 Sending to ${admins.length} admin(s)`);

      // Pre-generate attachments once for all admins
      const attachments = await this.generateWeeklySummaryAttachments(unresolvedIssues, pendingRequests);

      // Send email to each admin
      const emailResults = [];
      for (const admin of admins) {
        // Skip if admin has email notifications disabled
        if (!admin.email_notifications) {
          console.log(`⏭️ Skipping ${admin.email} - email notifications disabled`);
          continue;
        }

        if (!admin.email) {
          console.log(`⚠️ Skipping ${admin.name} - no email address`);
          continue;
        }

        try {
          const htmlContent = this.generateWeeklySummaryEmailHtml(
            admin.name,
            unresolvedIssues,
            pendingRequests
          );
          const textContent = this.generateWeeklySummaryEmailText(
            admin.name,
            unresolvedIssues,
            pendingRequests
          );

          await this.sendEmailNotification(
            admin.email,
            `Weekly Summary: ${unresolvedIssues.length} Unresolved Issues & ${pendingRequests.length} Pending Asset Requests`,
            htmlContent,
            textContent,
            attachments
          );

          emailResults.push({ admin: admin.email, success: true });
          console.log(`✅ Weekly summary sent to ${admin.email}`);
        } catch (error) {
          console.error(`❌ Failed to send weekly summary to ${admin.email}:`, error);
          emailResults.push({ admin: admin.email, success: false, error: error.message });
        }
      }

      return {
        success: true,
        message: 'Weekly summary notification process completed',
        stats: {
          unresolvedIssues: unresolvedIssues.length,
          pendingRequests: pendingRequests.length,
          adminsNotified: emailResults.filter(r => r.success).length,
          adminsFailed: emailResults.filter(r => !r.success).length
        },
        results: emailResults
      };
    } catch (error) {
      console.error('❌ Error in sendWeeklySummaryToAdmins:', error);
      return { success: false, message: error.message };
    }
  }

  // Generate HTML email for weekly summary
  generateWeeklySummaryEmailHtml(adminName, unresolvedIssues, pendingRequests) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const issuesUrl = `${frontendUrl}/admin/issues`;
    const requestsUrl = `${frontendUrl}/admin/asset-requests`;

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const titleCell = (name, ...lines) => td(
      `<div class="em-h" style="font-weight:600;color:${LIGHT.heading};">${name}</div>` +
      lines.filter(Boolean).map(l => `<div class="em-muted" style="font-size:12px;color:${LIGHT.muted};margin-top:4px;">${l}</div>`).join('')
    );

    const issuesListHtml = unresolvedIssues.length > 0
      ? unresolvedIssues.slice(0, 10).map(issue => `
          <tr>
            ${titleCell(
              issue.title || 'Untitled Issue',
              issue.description ? `${(issue.description || '').substring(0, 160)}${(issue.description || '').length > 160 ? '…' : ''}` : '',
              `Reported By: ${issue.reported_by_name || 'Unknown'} • ${formatDate(issue.created_at)}`
            )}
            ${td(badge(issue.status.replace('_', ' ').toUpperCase(), kindFor(issue.status)))}
            ${td(badge((issue.priority || 'medium').toUpperCase(), kindFor(issue.priority || 'medium')))}
            ${td(`${issue.reported_by_name || 'Unknown'}`, { muted: true })}
          </tr>
        `).join('')
      : `<tr>${td('No unresolved issues found.', { muted: true, colspan: 4, center: true })}</tr>`;

    const requestsListHtml = pendingRequests.length > 0
      ? pendingRequests.slice(0, 10).map(request => `
          <tr>
            ${titleCell(
              request.asset_name || 'Unnamed Asset',
              `${request.asset_type || ''} ${request.category ? `• ${request.category}` : ''}`,
              request.reason ? `Reason: ${(request.reason || '').substring(0, 160)}${(request.reason || '').length > 160 ? '…' : ''}` : ''
            )}
            ${td(badge((request.priority || 'medium').toUpperCase(), kindFor(request.priority || 'medium')))}
            ${td(`${request.user_name || 'Unknown'} ${request.user_email ? `(${request.user_email})` : ''}`, { muted: true })}
            ${td(formatDate(request.created_at), { muted: true })}
          </tr>
        `).join('')
      : `<tr>${td('No pending asset requests found.', { muted: true, colspan: 4, center: true })}</tr>`;

    const bodyHtml = [
      paragraph(`Hello ${adminName},`),
      paragraph('This is your weekly summary of unresolved issues and pending asset requests that require your attention.'),
      statCards([
        { label: 'Unresolved Issues', value: unresolvedIssues.length, note: 'Issues that are still open, in progress, or scheduled' },
        { label: 'Pending Asset Requests', value: pendingRequests.length, note: 'Requests awaiting approval or denial' },
      ]),
      sectionTitle(`🔴 Unresolved Issues (${unresolvedIssues.length})`),
      unresolvedIssues.length > 0
        ? dataTable(['Issue', 'Status', 'Priority', 'Reported By'], issuesListHtml) +
          (unresolvedIssues.length > 10 ? muted(`... and ${unresolvedIssues.length - 10} more unresolved issues`) : '') +
          button('View All Issues', issuesUrl)
        : muted('No unresolved issues. Great work! 🎉'),
      sectionTitle(`⏳ Pending Asset Requests (${pendingRequests.length})`),
      pendingRequests.length > 0
        ? dataTable(['Asset', 'Priority', 'Requested By', 'Requested Date'], requestsListHtml) +
          (pendingRequests.length > 10 ? muted(`... and ${pendingRequests.length - 10} more pending requests`) : '') +
          button('View All Requests', requestsUrl)
        : muted('No pending asset requests. All caught up! ✅'),
    ].join('');

    return wrapEmail({
      title: '📊 Weekly Summary Report',
      subtitle: 'Caava Group Assets Management System',
      preheader: `${unresolvedIssues.length} unresolved issues, ${pendingRequests.length} pending requests`,
      bodyHtml,
      footerHtml: `<p style="margin:0 0 6px;"><strong>Next Summary:</strong> You will receive the next weekly summary in 7 days.</p>
      <p style="margin:0 0 6px;">This is an automated notification from the Caava Group Assets Management System.</p>
      <p style="margin:0;">© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>`,
    });
  }

  // Generate text email for weekly summary
  generateWeeklySummaryEmailText(adminName, unresolvedIssues, pendingRequests) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const issuesUrl = `${frontendUrl}/admin/issues`;
    const requestsUrl = `${frontendUrl}/admin/asset-requests`;

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    let issuesText = '';
    if (unresolvedIssues.length > 0) {
      issuesText = unresolvedIssues.slice(0, 10).map(issue =>
        `- ${issue.title || 'Untitled Issue'} (${issue.status.toUpperCase()}, ${(issue.priority || 'medium').toUpperCase()})\n  Description: ${(issue.description || '').slice(0, 160)}${(issue.description || '').length > 160 ? '…' : ''}\n  Reported by: ${issue.reported_by_name || 'Unknown'} on ${formatDate(issue.created_at)}`
      ).join('\n');
      if (unresolvedIssues.length > 10) {
        issuesText += `\n... and ${unresolvedIssues.length - 10} more unresolved issues`;
      }
    } else {
      issuesText = 'No unresolved issues. Great work! 🎉';
    }

    let requestsText = '';
    if (pendingRequests.length > 0) {
      requestsText = pendingRequests.slice(0, 10).map(request =>
        `- ${request.asset_name || 'Unnamed Asset'} (${(request.priority || 'medium').toUpperCase()})\n  Requested by: ${request.user_name || 'Unknown'} on ${formatDate(request.created_at)}\n  Reason: ${(request.reason || '').slice(0, 160)}${(request.reason || '').length > 160 ? '…' : ''}`
      ).join('\n');
      if (pendingRequests.length > 10) {
        requestsText += `\n... and ${pendingRequests.length - 10} more pending requests`;
      }
    } else {
      requestsText = 'No pending asset requests. All caught up! ✅';
    }

    return `
Weekly Summary Report - Caava Group Assets Management System

Hello ${adminName},

This is your weekly summary of unresolved issues and pending asset requests that require your attention.

STATISTICS:
- Unresolved Issues: ${unresolvedIssues.length} (issues that are still open, in progress, or scheduled)
- Pending Asset Requests: ${pendingRequests.length} (requests awaiting approval or denial)

UNRESOLVED ISSUES (${unresolvedIssues.length}):
${issuesText}

View all issues: ${issuesUrl}

PENDING ASSET REQUESTS (${pendingRequests.length}):
${requestsText}

View all requests: ${requestsUrl}

Next Summary: You will receive the next weekly summary in 7 days.

This is an automated notification from the Caava Group Assets Management System.
© ${new Date().getFullYear()} Caava Group. All rights reserved.
    `;
  }

  // Generate PDF and DOCX attachments for weekly summary
  async generateWeeklySummaryAttachments(unresolvedIssues, pendingRequests) {
    const [pdfBuffer, docxBuffer] = await Promise.all([
      this.generateWeeklySummaryPdf(unresolvedIssues, pendingRequests),
      this.generateWeeklySummaryDocx(unresolvedIssues, pendingRequests)
    ]);

    const dateStr = new Date().toISOString().split('T')[0];

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `weekly-summary-${dateStr}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }
    if (docxBuffer) {
      attachments.push({
        filename: `weekly-summary-${dateStr}.docx`,
        content: docxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    }

    return attachments;
  }

  async generateWeeklySummaryPdf(unresolvedIssues, pendingRequests) {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      const fs = (await import('fs')).promises;
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const logoPath = path.resolve(__dirname, '../assets/logo.png');
      const logoBuffer = await fs.readFile(logoPath).catch(() => null);

      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      return await new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Brand colors
        const primary = '#152F52';
        const secondary = '#152F52';

        // Header banner
        const pageWidth = doc.page.width;
        const bannerX = 50;
        const bannerY = 50;
        const bannerW = pageWidth - 100;
        const bannerH = 80;
        doc.save();
        doc.roundedRect(bannerX, bannerY, bannerW, bannerH, 12).fill(secondary);

        // Logo (if available)
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, bannerX + 16, bannerY + 16, { fit: [48, 48] });
          } catch { }
        }

        // Header text
        doc.fillColor('white').fontSize(18).text('Weekly Summary Report', bannerX + 80, bannerY + 20, {
          width: bannerW - 100,
          align: 'left'
        });
        doc.fontSize(10).fillColor('#E5E7EB').text(`Generated: ${new Date().toLocaleString()}`, bannerX + 80, bannerY + 45, {
          width: bannerW - 100,
          align: 'left'
        });
        doc.restore();

        doc.moveDown(3.5);
        doc.fillColor('#111827');

        // Stats
        doc.fontSize(14).fillColor(primary).text('Statistics');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#111827').text(`Unresolved Issues: ${unresolvedIssues.length}`);
        doc.fontSize(12).text(`Pending Asset Requests: ${pendingRequests.length}`);
        doc.moveDown(1);

        // Unresolved Issues
        doc.fontSize(14).fillColor(primary).text(`Unresolved Issues (${unresolvedIssues.length})`);
        doc.moveDown(0.5);
        if (unresolvedIssues.length === 0) {
          doc.fontSize(12).fillColor('#6B7280').text('No unresolved issues.');
        } else {
          unresolvedIssues.slice(0, 50).forEach((issue, idx) => {
            doc.fillColor('#111827').fontSize(12).text(`${idx + 1}. ${issue.title || 'Untitled Issue'}`);
            if (issue.description) {
              const desc = String(issue.description);
              doc.fontSize(10).fillColor('#6B7280').text(`Description: ${desc}`, {
                width: doc.page.width - 100
              });
            }
            doc.fontSize(10).fillColor('#6B7280').text(`Reported by: ${issue.reported_by_name || 'Unknown'} • ${new Date(issue.created_at).toLocaleDateString()}`);
            doc.fontSize(10).fillColor('#6B7280').text(`Status: ${issue.status} • Priority: ${issue.priority || 'medium'}`);
            doc.moveDown(0.5);
          });
        }
        doc.moveDown(1);

        // Pending Requests
        doc.fillColor(primary).fontSize(14).text(`Pending Asset Requests (${pendingRequests.length})`);
        doc.moveDown(0.5);
        if (pendingRequests.length === 0) {
          doc.fontSize(12).fillColor('#6B7280').text('No pending asset requests.');
        } else {
          pendingRequests.slice(0, 50).forEach((req, idx) => {
            doc.fillColor('#111827').fontSize(12).text(`${idx + 1}. ${req.asset_name || 'Unnamed Asset'}`);
            doc.fontSize(10).fillColor('#6B7280').text(`Priority: ${req.priority || 'medium'} • Requested by: ${req.user_name || 'Unknown'} • Date: ${new Date(req.created_at).toLocaleDateString()}`);
            if (req.reason) {
              const reason = String(req.reason);
              doc.fontSize(10).fillColor('#6B7280').text(`Reason: ${reason}`, {
                width: doc.page.width - 100
              });
            }
            doc.moveDown(0.5);
          });
        }

        doc.end();
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  }

  async generateWeeklySummaryDocx(unresolvedIssues, pendingRequests) {
    try {
      const docx = await import('docx');
      const fs = (await import('fs')).promises;
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const logoPath = path.resolve(__dirname, '../assets/logo.png');
      const logoBuffer = await fs.readFile(logoPath).catch(() => null);
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } = docx;

      const headerChildren = [];
      if (logoBuffer) {
        headerChildren.push(new ImageRun({ data: logoBuffer, transformation: { width: 64, height: 64 } }));
      }
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Caava Group Assets Management System', bold: true, size: 28, color: '3b82f6' }),
        ]
      }));

      const title = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Weekly Summary Report', bold: true, size: 32, color: '10b981' })]
      });

      const generated = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Generated: ', bold: true, color: '6B7280' }),
          new TextRun({ text: new Date().toLocaleString(), color: '6B7280' })
        ]
      });

      const statsHeading = new Paragraph({ text: 'Statistics', heading: HeadingLevel.HEADING_2 });
      const stats1 = new Paragraph(`Unresolved Issues: ${unresolvedIssues.length}`);
      const stats2 = new Paragraph(`Pending Asset Requests: ${pendingRequests.length}`);

      const issuesHeading = new Paragraph({ text: `Unresolved Issues (${unresolvedIssues.length})`, heading: HeadingLevel.HEADING_2 });
      const issueParas = unresolvedIssues.length === 0
        ? [new Paragraph('No unresolved issues.')]
        : unresolvedIssues.slice(0, 50).flatMap((issue, idx) => [
          new Paragraph({
            children: [new TextRun({ text: `${idx + 1}. ${issue.title || 'Untitled Issue'}`, bold: true })]
          }),
          ...(issue.description ? [new Paragraph({ children: [new TextRun({ text: `Description: ${String(issue.description)}`, color: '6B7280' })] })] : []),
          new Paragraph({ children: [new TextRun({ text: `Reported by: ${issue.reported_by_name || 'Unknown'} • ${new Date(issue.created_at).toLocaleDateString()}`, color: '6B7280' })] }),
          new Paragraph({ children: [new TextRun({ text: `Status: ${issue.status} • Priority: ${issue.priority || 'medium'}`, color: '6B7280' })] })
        ]);

      const requestsHeading = new Paragraph({ text: `Pending Asset Requests (${pendingRequests.length})`, heading: HeadingLevel.HEADING_2 });
      const requestParas = pendingRequests.length === 0
        ? [new Paragraph('No pending asset requests.')]
        : pendingRequests.slice(0, 50).flatMap((req, idx) => [
          new Paragraph({
            children: [new TextRun({ text: `${idx + 1}. ${req.asset_name || 'Unnamed Asset'}`, bold: true })]
          }),
          new Paragraph({ children: [new TextRun({ text: `Priority: ${req.priority || 'medium'} • Requested by: ${req.user_name || 'Unknown'} • Date: ${new Date(req.created_at).toLocaleDateString()}`, color: '6B7280' })] }),
          ...(req.reason ? [new Paragraph({ children: [new TextRun({ text: `Reason: ${String(req.reason)}`, color: '6B7280' })] })] : [])
        ]);

      const document = new Document({
        sections: [{
          children: [
            ...(logoBuffer ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoBuffer, transformation: { width: 64, height: 64 } })] })] : []),
            title,
            generated,
            statsHeading,
            stats1,
            stats2,
            issuesHeading,
            ...issueParas,
            requestsHeading,
            ...requestParas
          ]
        }]
      });

      const buffer = await Packer.toBuffer(document);
      return buffer;
    } catch (error) {
      console.error('Error generating DOCX:', error);
      return null;
    }
  }
}

export default new NotificationService();