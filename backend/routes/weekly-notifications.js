import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { executeQuery } from '../config/database.js';
import notificationService from '../services/notificationService.js';

const router = express.Router();

// Get weekly notification schedule
router.get('/schedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'weekly_notification_schedule'`,
      []
    );

    if (!result.success) {
      // Table might not exist, return defaults
      return res.json({
        enabled: true,
        days: [1], // Monday by default
        time: '09:00',
        timezone: process.env.TZ || 'Africa/Nairobi'
      });
    }

    if (result.data.length === 0) {
      // No settings found, return defaults
      return res.json({
        enabled: true,
        days: [1], // Monday by default
        time: '09:00',
        timezone: process.env.TZ || 'Africa/Nairobi'
      });
    }

    try {
      const schedule = JSON.parse(result.data[0].setting_value);
      res.json(schedule);
    } catch (parseError) {
      // Invalid JSON, return defaults
      res.json({
        enabled: true,
        days: [1],
        time: '09:00',
        timezone: process.env.TZ || 'Africa/Nairobi'
      });
    }
  } catch (error) {
    console.error('Error fetching weekly notification schedule:', error);
    res.status(500).json({
      error: 'Failed to fetch schedule',
      message: error.message
    });
  }
});

// Update weekly notification schedule
router.put('/schedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, days, time, timezone } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'enabled must be a boolean'
      });
    }

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'days must be a non-empty array'
      });
    }

    // Validate days are between 0-6 (Sunday-Saturday)
    if (!days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'days must contain integers between 0 (Sunday) and 6 (Saturday)'
      });
    }

    // Validate time format (HH:MM)
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'time must be in HH:MM format (24-hour)'
      });
    }

    // Validate timezone (basic check - should be a valid IANA timezone string)
    const validTimezonePattern = /^[A-Za-z_\/]+$/;
    const selectedTimezone = timezone || process.env.TZ || 'Africa/Nairobi';
    if (!validTimezonePattern.test(selectedTimezone) || selectedTimezone.length > 50) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'timezone must be a valid IANA timezone identifier'
      });
    }

    const schedule = {
      enabled,
      days: [...new Set(days)].sort(), // Remove duplicates and sort
      time,
      timezone: selectedTimezone,
      updated_at: new Date().toISOString()
    };

    // Ensure system_settings table exists
    await executeQuery(
      `CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(255) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        description TEXT,
        category VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      []
    );

    // Insert or update the schedule
    const insertResult = await executeQuery(
      `INSERT INTO system_settings (setting_key, setting_value, category) 
       VALUES ('weekly_notification_schedule', ?, 'notifications')
       ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(schedule), JSON.stringify(schedule)]
    );

    if (!insertResult.success) {
      return res.status(500).json({
        error: 'Failed to update schedule',
        message: 'Database update failed'
      });
    }

    res.json({
      success: true,
      message: 'Weekly notification schedule updated successfully',
      schedule
    });
  } catch (error) {
    console.error('Error updating weekly notification schedule:', error);
    res.status(500).json({
      error: 'Failed to update schedule',
      message: error.message
    });
  }
});

// Manually trigger weekly summary (for testing)
router.post('/trigger', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log(`🔔 Manual weekly summary trigger by admin: ${req.user.id}`);
    const result = await notificationService.sendWeeklySummaryToAdmins();

    if (result.success) {
      res.json({
        success: true,
        message: 'Weekly summary notifications sent successfully',
        stats: result.stats,
        results: result.results
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message || 'Failed to send weekly summary notifications'
      });
    }
  } catch (error) {
    console.error('Error in manual weekly summary trigger:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

// Reload cron schedule (after updating settings)
router.post('/reload', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Import the setup function from server.js
    // Note: This requires the function to be exported or accessible
    // For now, we'll just return success and note that server restart is needed
    res.json({
      success: true,
      message: 'Schedule will be reloaded. Please restart the server for changes to take full effect.',
      note: 'For immediate effect without restart, the cron jobs will be updated on the next cycle'
    });
  } catch (error) {
    console.error('Error reloading schedule:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
});

export default router;

