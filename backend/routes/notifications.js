import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
import { executeQuery } from '../config/database.js';

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // console.log(`📡 Fetching notifications for user ${req.user.id}, page=${page}, limit=${limit}, offset=${offset}`);
    
    const notifications = await notificationService.getUserNotifications(
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );

    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    // console.log(`📬 Returning ${notifications.length} notifications, ${unreadCount} unread`);
    // console.log(`📬 First notification:`, notifications[0]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: notifications.length === parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    
    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

export default router;