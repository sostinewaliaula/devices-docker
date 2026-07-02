import { executeQuery } from '../config/database.js';
import notificationService from './notificationService.js';

class CommentService {
  // Add comment to asset request
  async addComment(assetRequestId, userId, comment, parentCommentId = null) {
    try {
      // Get commenter details
      const userResult = await executeQuery(
        `SELECT name, role FROM users WHERE id = ?`,
        [userId]
      );

      const commenterName = userResult.data.length > 0 ? userResult.data[0].name : 'Unknown User';
      const commenterRole = userResult.data.length > 0 ? userResult.data[0].role : 'user';
      const isAdminComment = commenterRole === 'admin' || commenterRole === 'manager';

      // Generate UUID for the comment (since MySQL insertId doesn't work with UUID primary keys)
      const { randomUUID } = await import('crypto');
      const commentId = randomUUID();

      // Insert comment into asset_request_comments table
      const result = await executeQuery(
        `INSERT INTO asset_request_comments (id, asset_request_id, user_id, user_name, comment, parent_comment_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [commentId, assetRequestId, userId, commenterName, comment, parentCommentId]
      );

      if (!result.success || result.data.affectedRows === 0) {
        throw new Error('Failed to insert comment');
      }

      console.log(`💬 Comment added by ${commenterName} on asset request ${assetRequestId}`);

      // Notify other users about the new comment (non-blocking - run in background)
      this.notifyOtherUsers(assetRequestId, userId, commenterName, comment, isAdminComment)
        .catch(err => console.error('Error sending comment notifications:', err));

      return commentId;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Notify other users about new comment
  async notifyOtherUsers(assetRequestId, commenterId, commenterName, comment, isAdminComment) {
    try {
      // Get asset request details
      const assetResult = await executeQuery(
        `SELECT ar.asset_name, ar.user_id as requester_id, u.name as requester_name, u.email as requester_email
         FROM asset_requests ar
         JOIN users u ON ar.user_id = u.id
         WHERE ar.id = ?`,
        [assetRequestId]
      );

      if (assetResult.data.length === 0) return;

      const assetRequest = assetResult.data[0];
      const assetName = assetRequest.asset_name;

      // Create an array to store all notification promises
      const notificationPromises = [];

      // Notify the requester (if not the commenter)
      if (assetRequest.requester_id !== commenterId) {
        const title = isAdminComment ? 'Admin Response to Your Asset Request' : 'New Comment on Your Asset Request';
        const message = isAdminComment 
          ? `Admin ${commenterName} responded to your request for "${assetName}".`
          : `${commenterName} added a comment to your request for "${assetName}".`;

        // Add requester notification to promises
        notificationPromises.push(
          notificationService.createNotification(
            assetRequest.requester_id,
            assetRequestId,
            isAdminComment ? 'success' : 'info',
            title,
            message
          ).catch(err => console.error('Error creating requester notification:', err))
        );

        // Send email notification to requester
        const userPrefsResult = await executeQuery(
          `SELECT email_notifications FROM users WHERE id = ?`,
          [assetRequest.requester_id]
        );

        if (userPrefsResult.success && userPrefsResult.data && userPrefsResult.data.length > 0 && userPrefsResult.data[0].email_notifications) {
          const emailSubject = isAdminComment 
            ? `Admin Response on Asset Request - ${assetName}` 
            : `New Comment on Asset Request - ${assetName}`;
          const emailHtml = this.generateCommentEmailHtml(
            assetRequest.requester_name,
            assetName,
            commenterName,
            comment,
            isAdminComment,
            true // isRequester = true
          );
          const emailText = this.generateCommentEmailText(
            assetRequest.requester_name,
            assetName,
            commenterName,
            comment,
            isAdminComment,
            true // isRequester = true
          );

          notificationPromises.push(
            notificationService.sendEmailNotification(
              assetRequest.requester_email,
              emailSubject,
              emailHtml,
              emailText
            ).catch(err => console.error('Error sending requester email:', err))
          );
        }
      }

      // Notify all admins/managers about new comments (except the commenter)
      const adminsResult = await executeQuery(
        `SELECT id, name, email FROM users WHERE (role = 'admin' OR role = 'manager') AND is_active = TRUE AND id != ?`,
        [commenterId]
      );

      if (adminsResult.success) {
        for (const admin of adminsResult.data) {
          const title = isAdminComment ? 'Admin Comment on Asset Request' : 'New Comment on Asset Request';
          const message = isAdminComment
            ? `Admin ${commenterName} commented on ${assetRequest.requester_name}'s request for "${assetName}".`
            : `${commenterName} added a comment to ${assetRequest.requester_name}'s request for "${assetName}".`;

          // Add admin notification to promises
          notificationPromises.push(
            notificationService.createNotification(
              admin.id,
              assetRequestId,
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
              ? `Admin Comment on Asset Request - ${assetName}` 
              : `New Comment on Asset Request - ${assetName}`;
            const emailHtml = this.generateCommentEmailHtml(
              admin.name,
              assetName,
              commenterName,
              comment,
              isAdminComment,
              false, // isRequester = false
              assetRequest.requester_name // requesterName
            );
            const emailText = this.generateCommentEmailText(
              admin.name,
              assetName,
              commenterName,
              comment,
              isAdminComment,
              false, // isRequester = false
              assetRequest.requester_name // requesterName
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
      
      // Wait for all notifications to complete (in parallel)
      await Promise.all(notificationPromises);
      
      console.log(`✅ Comment notifications sent for asset request ${assetRequestId}`);
    } catch (error) {
      console.error('Error notifying users about comment:', error);
    }
  }

  // Get comments for asset request
  async getComments(assetRequestId) {
    try {
      const result = await executeQuery(
        `SELECT c.*, u.email as user_email
         FROM asset_request_comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.asset_request_id = ?
         ORDER BY c.created_at ASC`,
        [assetRequestId]
      );

      // Convert to comment format with replies
      const comments = result.data.map(comment => ({
        id: comment.id,
        asset_request_id: comment.asset_request_id,
        user_id: comment.user_id,
        user_name: comment.user_name,
        user_email: comment.user_email,
        comment: comment.comment,
        parent_comment_id: comment.parent_comment_id,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        replies: [] // Will be populated if needed
      }));

      // Organize comments and replies
      const organizedComments = this.organizeComments(comments);
      return organizedComments;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  // Organize comments into parent-child structure
  organizeComments(comments) {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into hierarchy
    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return rootComments;
  }

  // Update comment
  async updateComment(commentId, userId, newComment) {
    try {
      // Check if user owns the comment
      const result = await executeQuery(
        `SELECT user_id FROM asset_request_comments WHERE id = ?`,
        [commentId]
      );

      if (!result.success) {
        throw new Error('Database query failed');
      }

      if (result.data.length === 0) {
        throw new Error('Comment not found');
      }

      if (result.data[0].user_id !== userId) {
        throw new Error('Unauthorized: You can only edit your own comments');
      }

      await executeQuery(
        `UPDATE asset_request_comments 
         SET comment = ?, updated_at = NOW() 
         WHERE id = ?`,
        [newComment, commentId]
      );

      return true;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  // Delete comment
  async deleteComment(commentId, userId, isAdmin = false) {
    try {
      // Check if user owns the comment or is admin
      const result = await executeQuery(
        `SELECT user_id FROM asset_request_comments WHERE id = ?`,
        [commentId]
      );

      if (!result.success) {
        throw new Error('Database query failed');
      }

      if (result.data.length === 0) {
        throw new Error('Comment not found');
      }

      if (!isAdmin && result.data[0].user_id !== userId) {
        throw new Error('Unauthorized: You can only delete your own comments');
      }

      // Delete comment and all its replies
      await executeQuery(
        `DELETE FROM asset_request_comments WHERE id = ? OR parent_comment_id = ?`,
        [commentId, commentId]
      );

      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  // Get comment by ID
  async getCommentById(commentId) {
    try {
      const result = await executeQuery(
        `SELECT c.*, u.email as user_email
         FROM asset_request_comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = ?`,
        [commentId]
      );

      if (result.data.length > 0) {
        const comment = result.data[0];
        return {
          id: comment.id,
          asset_request_id: comment.asset_request_id,
          user_id: comment.user_id,
          user_name: comment.user_name,
          user_email: comment.user_email,
          comment: comment.comment,
          parent_comment_id: comment.parent_comment_id,
          created_at: comment.created_at,
          updated_at: comment.updated_at
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching comment:', error);
      return null;
    }
  }

  // Get comment count for asset request
  async getCommentCount(assetRequestId) {
    try {
      const result = await executeQuery(
        `SELECT COUNT(*) as count 
         FROM asset_request_comments 
         WHERE asset_request_id = ?`,
        [assetRequestId]
      );

      return result.data[0].count;
    } catch (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }
  }

  // Generate HTML email for comment
  generateCommentEmailHtml(userName, assetName, commenterName, comment, isAdminComment = false, isRequester = true, requesterName = null) {
    const requestOwner = isRequester ? 'your' : `${requesterName}'s`;
    const actionText = isAdminComment ? 'responded to' : 'added a comment to';
    
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
            <h1>${isAdminComment ? 'Admin Response on Asset Request' : 'New Comment on Asset Request'}</h1>
            <p>Hello ${userName},</p>
          </div>
          
          <div class="content">
            <p><strong>${isAdminComment ? 'Admin ' : ''}${commenterName}</strong> ${actionText} ${requestOwner} request for <strong>${assetName}</strong>:</p>
            
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
  generateCommentEmailText(userName, assetName, commenterName, comment, isAdminComment = false, isRequester = true, requesterName = null) {
    const requestOwner = isRequester ? 'your' : `${requesterName}'s`;
    const actionText = isAdminComment ? 'responded to' : 'added a comment to';
    
    return `
${isAdminComment ? 'Admin Response on Asset Request' : 'New Comment on Asset Request'}

Hello ${userName},

${isAdminComment ? 'Admin ' : ''}${commenterName} ${actionText} ${requestOwner} request for ${assetName}:

${comment}

You can view the full conversation and add your own comments in your dashboard.

This is an automated notification from the Asset Management System.
Please do not reply to this email.
    `;
  }
}

export default new CommentService();