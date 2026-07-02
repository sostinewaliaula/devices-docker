import emailService from './emailService.js';
import { executeQuery } from '../config/database.js';
import { sanitizePagination } from '../utils/pagination.js';

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
    const statusColors = {
      'submitted': '#3b82f6',
      'pending': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'fulfilled': '#3b82f6'
    };

    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Device Request Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${statusColors[newStatus]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Device Request Update</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p>Your device request has been updated:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Asset:</strong> ${assetName}</li>
              <li><strong>Status:</strong> <span class="status-badge">${statusText[newStatus]}</span></li>
              ${adminName ? `<li><strong>Updated by:</strong> ${adminName}</li>` : ''}
            </ul>
            
            ${reason ? `
            <h3>Original Request</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You can view the full details and add comments in your dashboard.</p>
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
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Comment on Asset Request</title>
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
            <h1>New Comment on Asset Request</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p><strong>${commenterName}</strong> added a comment to your request for <strong>${assetName}</strong>:</p>
            
            <div class="comment">
              ${comment}
            </div>
            
            <p>You can view the full conversation and add your own comments in your dashboard.</p>
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
    const statusColors = {
      'submitted': '#3b82f6',
      'pending': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'fulfilled': '#3b82f6'
    };

    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Asset Request Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${statusColors[newStatus]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Asset Request Update</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p>Your asset request has been updated:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Asset:</strong> ${assetName}</li>
              <li><strong>Status:</strong> <span class="status-badge">${statusText[newStatus]}</span></li>
              ${adminName ? `<li><strong>Updated by:</strong> ${adminName}</li>` : ''}
            </ul>
            
            ${reason ? `
            <h3>Your Original Request</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You can view the full details and add comments in your dashboard.</p>
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
    const statusColors = {
      'submitted': '#3b82f6',
      'pending': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'fulfilled': '#3b82f6'
    };

    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Team Member's Asset Request Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${statusColors[newStatus]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Team Member's Asset Request Update</h1>
            <p>Hello ${managerName},</p>
          </div>
          
          <div class="content">
            <p>A team member's asset request has been updated:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Requester:</strong> ${requesterName}</li>
              <li><strong>Asset:</strong> ${assetName}</li>
              <li><strong>Status:</strong> <span class="status-badge">${statusText[newStatus]}</span></li>
              ${adminName ? `<li><strong>Updated by:</strong> ${adminName}</li>` : ''}
            </ul>
            
            ${reason ? `
            <h3>Original Request</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You can view the full details and add comments in your dashboard.</p>
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
    const statusColors = {
      'submitted': '#3b82f6',
      'pending': '#f59e0b',
      'approved': '#10b981',
      'rejected': '#ef4444',
      'fulfilled': '#3b82f6'
    };

    const statusText = {
      'submitted': 'Submitted',
      'pending': 'Pending Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
      'fulfilled': 'Fulfilled'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Asset Request Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${statusColors[newStatus]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Asset Request Update</h1>
            <p>Hello ${adminName},</p>
          </div>
          
          <div class="content">
            <p>An asset request has been updated:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Requester:</strong> ${requesterName}</li>
              <li><strong>Asset:</strong> ${assetName}</li>
              <li><strong>Status:</strong> <span class="status-badge">${statusText[newStatus]}</span></li>
              ${updatedBy ? `<li><strong>Updated by:</strong> ${updatedBy}</li>` : ''}
            </ul>
            
            ${reason ? `
            <h3>Original Request</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You can view the full details and add comments in your dashboard.</p>
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
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Asset Request Submitted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: #3b82f6;
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Asset Request Submitted</h1>
            <p>Hello ${adminName},</p>
          </div>
          
          <div class="content">
            <p>A new asset request has been submitted and requires your attention:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Requester:</strong> ${requesterName}</li>
              <li><strong>Asset:</strong> ${assetName}</li>
              <li><strong>Type:</strong> ${assetType}</li>
              <li><strong>Status:</strong> <span class="status-badge">Submitted</span></li>
            </ul>
            
            ${reason ? `
            <h3>Request Details</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>Please review and take appropriate action on this request in your dashboard.</p>
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
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Device Request Has Been Submitted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: #3b82f6;
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Device Request Has Been Submitted</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p>Your device request has been successfully submitted and is now under review:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Device:</strong> ${assetName}</li>
              <li><strong>Type:</strong> ${assetType}</li>
              <li><strong>Status:</strong> <span class="status-badge">Submitted</span></li>
            </ul>
            
            ${reason ? `
            <h3>Your Request Details</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You will be notified once your request is reviewed and a decision is made. You can track the progress in your dashboard.</p>
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
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Team Member Submitted New Device Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: #3b82f6;
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Team Member Submitted New Device Request</h1>
            <p>Hello ${managerName},</p>
          </div>
          
          <div class="content">
            <p>A team member from your department has submitted a new device request:</p>
            
            <h2>Request Details</h2>
            <ul>
              <li><strong>Requester:</strong> ${requesterName}</li>
              <li><strong>Device:</strong> ${assetName}</li>
              <li><strong>Type:</strong> ${assetType}</li>
              <li><strong>Status:</strong> <span class="status-badge">Submitted</span></li>
            </ul>
            
            ${reason ? `
            <h3>Request Details</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${reason}
            </p>
            ` : ''}
            
            <p>You can review this request and provide input in your dashboard. The request will be processed by the admin team.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Devices Management System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
    const priorityColors = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#3b82f6',
      'low': '#10b981'
    };

    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Issue Reported Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .priority-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${priorityColors[priority]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Issue Reported Successfully</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p>Your issue has been successfully reported and is being reviewed:</p>
            
            <h2>Issue Details</h2>
            <ul>
              <li><strong>Title:</strong> ${title}</li>
              <li><strong>Priority:</strong> <span class="priority-badge">${priorityText[priority]}</span></li>
              ${category ? `<li><strong>Category:</strong> ${category}</li>` : ''}
            </ul>
            
            <h3>Description</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${description}
            </p>
            
            <p>You will be notified once your issue is reviewed and assigned. You can track the progress in your dashboard.</p>
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
    const priorityColors = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#3b82f6',
      'low': '#10b981'
    };

    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Team Member Reported New Issue</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .priority-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${priorityColors[priority]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Team Member Reported New Issue</h1>
            <p>Hello ${managerName},</p>
          </div>
          
          <div class="content">
            <p>A team member from your department has reported a new issue:</p>
            
            <h2>Issue Details</h2>
            <ul>
              <li><strong>Reporter:</strong> ${reporterName}</li>
              <li><strong>Title:</strong> ${title}</li>
              <li><strong>Priority:</strong> <span class="priority-badge">${priorityText[priority]}</span></li>
              ${category ? `<li><strong>Category:</strong> ${category}</li>` : ''}
              ${assetName ? `<li><strong>Asset:</strong> ${assetName}</li>` : ''}
            </ul>
            
            <h3>Description</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${description}
            </p>
            
            <p>Please review this issue and provide input in your dashboard. The issue will be processed by the admin team.</p>
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
    const priorityColors = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#3b82f6',
      'low': '#10b981'
    };

    const priorityText = {
      'critical': 'Critical',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Issue Reported</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .priority-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 20px; 
            color: white; 
            font-weight: bold;
            background-color: ${priorityColors[priority]};
          }
          .content { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Issue Reported</h1>
            <p>Hello ${adminName},</p>
          </div>
          
          <div class="content">
            <p>A new issue has been reported and requires your attention:</p>
            
            <h2>Issue Details</h2>
            <ul>
              <li><strong>Reporter:</strong> ${reporterName}</li>
              <li><strong>Title:</strong> ${title}</li>
              <li><strong>Priority:</strong> <span class="priority-badge">${priorityText[priority]}</span></li>
              ${category ? `<li><strong>Category:</strong> ${category}</li>` : ''}
              ${assetName ? `<li><strong>Asset:</strong> ${assetName}</li>` : ''}
            </ul>
            
            <h3>Description</h3>
            <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
              ${description}
            </p>
            
            <p>Please review and take appropriate action on this issue in your dashboard.</p>
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

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Caava Group Devices</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f3f4f6; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); 
            padding: 40px 20px; 
            text-align: center; 
            color: white; 
          }
          .logo { font-size: 48px; font-weight: bold; margin-bottom: 10px; }
          .company { font-size: 24px; font-weight: 700; margin-bottom: 5px; }
          .subtitle { font-size: 14px; opacity: 0.9; }
          .content { padding: 30px 20px; }
          .welcome-title { color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 15px; }
          .message { color: #4b5563; margin-bottom: 20px; }
          .login-box { 
            background: #f9fafb; 
            border: 2px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
          }
          .login-title { font-weight: 600; color: #1f2937; margin-bottom: 10px; }
          .login-url { 
            color: #3b82f6; 
            font-size: 16px; 
            word-break: break-all; 
            text-decoration: none; 
          }
          .credentials { 
            background: #fef3c7; 
            border-left: 4px solid #f59e0b; 
            padding: 15px; 
            margin: 20px 0; 
            border-radius: 4px; 
          }
          .credentials-title { font-weight: 600; color: #92400e; margin-bottom: 10px; }
          .credential-item { color: #78350f; margin: 8px 0; }
          .next-steps { margin: 20px 0; }
          .next-steps-title { font-weight: 600; color: #1f2937; margin-bottom: 10px; }
          .step { color: #4b5563; margin: 8px 0; padding-left: 10px; }
          .footer { 
            background: #f9fafb; 
            padding: 20px; 
            text-align: center; 
            color: #6b7280; 
            font-size: 12px; 
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 15px 0; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">C</div>
            <div class="company">Caava Group</div>
            <div class="subtitle">Assets Management System</div>
          </div>
          
          <div class="content">
            <h1 class="welcome-title">Welcome ${userName}! 🎉</h1>
            
            <div class="message">
              Your account has been successfully created. You can now access the Caava Group Assets Management System to manage your assets and track your requests.
            </div>
            
            <div class="login-box">
              <div class="login-title">🔗 Access Your Account</div>
              <a href="${loginUrl}" class="login-url">${loginUrl}</a>
            </div>
            
            <div class="credentials">
              <div class="credentials-title">📧 Your Login Credentials:</div>
              <div class="credential-item"><strong>Email:</strong> ${userEmail}</div>
              <div class="credential-item"><strong>Temporary Password:</strong> ${temporaryPassword}</div>
            </div>
            
            <div class="next-steps">
              <div class="next-steps-title">🚀 Next Steps:</div>
              <div class="step">1. Click the login URL above or visit the site</div>
              <div class="step">2. Log in with your email and temporary password</div>
              <div class="step">3. Change your password in the security settings</div>
              <div class="step">4. Complete your profile information</div>
            </div>
            
            <div class="message">
              If you have any questions or need assistance, please don't hesitate to contact your administrator or the support team.
            </div>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Login to Your Account</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Caava Group Assets Management System.</p>
            <p>© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
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

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New User Registration</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f3f4f6; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); 
            padding: 30px 20px; 
            text-align: center; 
            color: white; 
          }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px 20px; }
          .alert-box { 
            background: #fef3c7; 
            border-left: 4px solid #f59e0b; 
            padding: 15px; 
            margin: 20px 0; 
            border-radius: 4px; 
          }
          .alert-title { font-weight: 600; color: #92400e; margin-bottom: 10px; }
          .user-details { 
            background: #f9fafb; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
          }
          .detail-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e5e7eb; 
          }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #4b5563; }
          .detail-value { color: #1f2937; }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            margin: 15px 0; 
          }
          .footer { 
            background: #f9fafb; 
            padding: 20px; 
            text-align: center; 
            color: #6b7280; 
            font-size: 12px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New User Registration</h1>
          </div>
          
          <div class="content">
            <p>Hello ${adminName},</p>
            
            <div class="alert-box">
              <div class="alert-title">Action Required</div>
              <p style="color: #78350f; margin: 0;">A new user has successfully registered and created their account.</p>
            </div>
            
            <div class="user-details">
              <h2 style="margin-top: 0; color: #1f2937;">User Details</h2>
              <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${userName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">${userEmail}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Position:</span>
                <span class="detail-value">${position}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department:</span>
                <span class="detail-value">${department}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">${phone}</span>
              </div>
            </div>
            
            <p style="color: #4b5563;">
              The user has been automatically assigned the "user" role and can now access the system. 
              You can review and manage this user in the User Management section.
            </p>
            
            <div style="text-align: center;">
              <a href="${userManagementUrl}" class="button">View User Management</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Caava Group Assets Management System.</p>
            <p>© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
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

    const priorityColors = {
      'critical': '#ef4444',
      'high': '#f59e0b',
      'medium': '#3b82f6',
      'low': '#10b981',
      'urgent': '#ef4444'
    };

    const statusColors = {
      'open': '#ef4444',
      'in_progress': '#f59e0b',
      'scheduled': '#3b82f6',
      'pending': '#f59e0b'
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const issuesListHtml = unresolvedIssues.length > 0
      ? unresolvedIssues.slice(0, 10).map(issue => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #1f2937;">${issue.title || 'Untitled Issue'}</div>
              ${issue.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${(issue.description || '').substring(0, 160)}${(issue.description || '').length > 160 ? '…' : ''}</div>` : ''}
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Reported By: ${issue.reported_by_name || 'Unknown'} • ${formatDate(issue.created_at)}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                background-color: ${statusColors[issue.status] || '#6b7280'}20;
                color: ${statusColors[issue.status] || '#6b7280'};
              ">${issue.status.replace('_', ' ').toUpperCase()}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                background-color: ${priorityColors[issue.priority] || '#6b7280'}20;
                color: ${priorityColors[issue.priority] || '#6b7280'};
              ">${(issue.priority || 'medium').toUpperCase()}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              ${issue.reported_by_name || 'Unknown'}
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #6b7280;">No unresolved issues found.</td></tr>';

    const requestsListHtml = pendingRequests.length > 0
      ? pendingRequests.slice(0, 10).map(request => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: 600; color: #1f2937;">${request.asset_name || 'Unnamed Asset'}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                ${request.asset_type || ''} ${request.category ? `• ${request.category}` : ''}
              </div>
              ${request.reason ? `<div style=\"font-size: 12px; color: #6b7280; margin-top: 4px;\">Reason: ${(request.reason || '').substring(0, 160)}${(request.reason || '').length > 160 ? '…' : ''}</div>` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                background-color: ${priorityColors[request.priority] || '#6b7280'}20;
                color: ${priorityColors[request.priority] || '#6b7280'};
              ">${(request.priority || 'medium').toUpperCase()}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              ${request.user_name || 'Unknown'} ${request.user_email ? `(${request.user_email})` : ''}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              ${formatDate(request.created_at)}
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #6b7280;">No pending asset requests found.</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Summary - Unresolved Issues & Pending Requests</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
          .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
          .stat-number { font-size: 36px; font-weight: 700; color: #3b82f6; margin: 10px 0; }
          .stat-label { font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
          .section { margin: 40px 0; }
          .section-title { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 10px 0 0; }
          .footer { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #6b7280; text-align: center; }
          .more-info { margin-top: 15px; font-size: 14px; color: #6b7280; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">📊 Weekly Summary Report</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Caava Group Assets Management System</p>
          </div>
          
          <div class="content">
            <p>Hello ${adminName},</p>
            
            <p>This is your weekly summary of unresolved issues and pending asset requests that require your attention.</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Unresolved Issues</div>
                <div class="stat-number">${unresolvedIssues.length}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 10px;">
                  Issues that are still open, in progress, or scheduled
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Pending Asset Requests</div>
                <div class="stat-number">${pendingRequests.length}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 10px;">
                  Requests awaiting approval or denial
                </div>
              </div>
            </div>

            <div class="section">
              <h2 class="section-title">🔴 Unresolved Issues (${unresolvedIssues.length})</h2>
              ${unresolvedIssues.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Reported By</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${issuesListHtml}
                  </tbody>
                </table>
                ${unresolvedIssues.length > 10 ? `<div class="more-info">... and ${unresolvedIssues.length - 10} more unresolved issues</div>` : ''}
                <a href="${issuesUrl}" class="button">View All Issues</a>
              ` : '<p style="color: #6b7280;">No unresolved issues. Great work! 🎉</p>'}
            </div>

            <div class="section">
              <h2 class="section-title">⏳ Pending Asset Requests (${pendingRequests.length})</h2>
              ${pendingRequests.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Priority</th>
                      <th>Requested By</th>
                      <th>Requested Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${requestsListHtml}
                  </tbody>
                </table>
                ${pendingRequests.length > 10 ? `<div class="more-info">... and ${pendingRequests.length - 10} more pending requests</div>` : ''}
                <a href="${requestsUrl}" class="button">View All Requests</a>
              ` : '<p style="color: #6b7280;">No pending asset requests. All caught up! ✅</p>'}
            </div>

            <div class="footer">
              <p><strong>Next Summary:</strong> You will receive the next weekly summary in 7 days.</p>
              <p style="margin-top: 10px;">This is an automated notification from the Caava Group Assets Management System.</p>
              <p>© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
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
        const primary = '#10b981';
        const secondary = '#3b82f6';

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