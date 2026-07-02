import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

// Get user notification preferences
router.get('/users/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // Check if user is requesting their own preferences or is an admin
    if (requestingUser.id !== userId && requestingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [rows] = await db.execute(
      'SELECT email_notifications, in_app_notifications FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];
    
    // Return preferences with default values for additional fields
    const preferences = {
      email_notifications: Boolean(user.email_notifications),
      in_app_notifications: Boolean(user.in_app_notifications),
      notification_types: ['success', 'error', 'warning', 'info'], // Default to all types
      email_frequency: 'immediate' // Default frequency
    };

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user notification preferences
router.put('/users/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;
    const { email_notifications, in_app_notifications } = req.body;

    // Check if user is updating their own preferences or is an admin
    if (requestingUser.id !== userId && requestingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate input
    if (typeof email_notifications !== 'boolean' || typeof in_app_notifications !== 'boolean') {
      return res.status(400).json({ message: 'Invalid preference values' });
    }

    // Update user preferences
    await db.execute(
      'UPDATE users SET email_notifications = ?, in_app_notifications = ? WHERE id = ?',
      [email_notifications, in_app_notifications, userId]
    );

    // Return updated preferences
    const preferences = {
      email_notifications,
      in_app_notifications,
      notification_types: ['success', 'error', 'warning', 'info'],
      email_frequency: 'immediate'
    };

    res.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user's notification preferences
router.get('/me', async (req, res) => {
  try {
    console.log('🔍 Notification preferences request received');
    console.log('👤 User:', req.user);
    
    const userId = req.user.id;
    console.log('🆔 User ID:', userId);

    // First, let's check if the user exists
    const [userCheck] = await db.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );
    
    console.log('👤 User check result:', userCheck);

    if (userCheck.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Now let's try to get the notification preferences
    try {
      const [rows] = await db.execute(
        'SELECT email_notifications, in_app_notifications FROM users WHERE id = ?',
        [userId]
      );

      console.log('📊 Notification preferences query result:', rows);

      const user = rows[0];
      
      const preferences = {
        email_notifications: Boolean(user.email_notifications),
        in_app_notifications: Boolean(user.in_app_notifications),
        notification_types: ['success', 'error', 'warning', 'info'],
        email_frequency: 'immediate'
      };

      console.log('✅ Returning preferences:', preferences);
      res.json(preferences);
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      
      // If the columns don't exist, return default values
      if (dbError.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ Notification columns don\'t exist, returning defaults');
        const preferences = {
          email_notifications: true,
          in_app_notifications: true,
          notification_types: ['success', 'error', 'warning', 'info'],
          email_frequency: 'immediate'
        };
        return res.json(preferences);
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('❌ Error fetching current user notification preferences:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      code: error.code
    });
  }
});

// Update current user's notification preferences
router.put('/me', async (req, res) => {
  try {
    console.log('🔍 Update notification preferences request received');
    console.log('👤 User:', req.user);
    console.log('📝 Request body:', req.body);
    
    const userId = req.user.id;
    const { email_notifications, in_app_notifications } = req.body;

    // Validate input
    if (typeof email_notifications !== 'boolean' || typeof in_app_notifications !== 'boolean') {
      return res.status(400).json({ message: 'Invalid preference values' });
    }

    try {
      // Update user preferences
      await db.execute(
        'UPDATE users SET email_notifications = ?, in_app_notifications = ? WHERE id = ?',
        [email_notifications, in_app_notifications, userId]
      );

      console.log('✅ Preferences updated successfully');

      // Return updated preferences
      const preferences = {
        email_notifications,
        in_app_notifications,
        notification_types: ['success', 'error', 'warning', 'info'],
        email_frequency: 'immediate'
      };

      res.json(preferences);
    } catch (dbError) {
      console.error('❌ Database error during update:', dbError);
      
      // If the columns don't exist, we can't update them
      if (dbError.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ Notification columns don\'t exist, cannot update');
        return res.status(400).json({ 
          message: 'Notification preferences not available. Please contact administrator to set up notification columns.',
          error: 'Missing database columns'
        });
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('❌ Error updating current user notification preferences:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      code: error.code
    });
  }
});

export default router;
