import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { executeQuery } from '../config/database.js';

const router = express.Router();

// Get backup schedule
router.get('/schedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'backup_schedule'`,
      []
    );

    if (!result.success || result.data.length === 0) {
      return res.json({ enabled: true, days: [1], time: '02:00', timezone: process.env.TZ || 'Africa/Nairobi' });
    }

    try {
      return res.json(JSON.parse(result.data[0].setting_value));
    } catch {
      return res.json({ enabled: true, days: [1], time: '02:00', timezone: process.env.TZ || 'Africa/Nairobi' });
    }
  } catch (error) {
    console.error('Error fetching backup schedule:', error);
    res.status(500).json({ error: 'Failed to fetch backup schedule' });
  }
});

// Update backup schedule
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

    await executeQuery(
      `CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(255) PRIMARY KEY, 
        setting_value TEXT NOT NULL, 
        description TEXT,
        category VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    const schedule = {
      enabled,
      days: [...new Set(days)].sort(),
      time,
      timezone: selectedTimezone,
      updated_at: new Date().toISOString()
    };

    const upsert = await executeQuery(
      `INSERT INTO system_settings (setting_key, setting_value, category) VALUES ('backup_schedule', ?, 'backup')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(schedule)]
    );

    if (!upsert.success) return res.status(500).json({ error: 'Failed to save schedule' });

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error updating backup schedule:', error);
    res.status(500).json({ error: 'Failed to update backup schedule' });
  }
});

// Reload cron schedule (after updating settings)
router.post('/reload', authenticateToken, requireAdmin, async (req, res) => {
  try {
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

// Manually trigger backup (for testing)
router.post('/trigger', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mysqldump = (await import('mysqldump')).default;
    const fs = await import('fs');
    const path = await import('path');
    const zlib = await import('zlib');
    const { default: notificationService } = await import('../services/notificationService.js');
    const { executeQuery } = await import('../config/database.js');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const storageDir = path.resolve(__dirname, '../storage/backups');

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const baseName = `backup_${timestamp}`;

    // Ensure storage directory exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const sqlFile = path.join(storageDir, `${baseName}.sql`);
    const gzFile = `${sqlFile}.gz`;
    const filename = `${baseName}.sql.gz`;

    // Generate SQL dump using mysqldump npm package
    await mysqldump({
      connection: {
        host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
        password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'assets',
      },
      dumpToFile: sqlFile,
    });

    // Gzip the SQL file
    await new Promise((resolve, reject) => {
      const src = fs.createReadStream(sqlFile);
      const dest = fs.createWriteStream(gzFile);
      src.pipe(zlib.createGzip()).pipe(dest).on('finish', resolve).on('error', reject);
    });

    // Remove uncompressed .sql to save space
    try {
      fs.unlinkSync(sqlFile);
    } catch (e) {
      // Ignore if file doesn't exist
    }

    // Fetch recipients
    let recipientEmails = [];
    try {
      const rec = await executeQuery(`SELECT email FROM backup_email_recipients WHERE is_active = TRUE`);
      if (rec.success) recipientEmails = rec.data.map(r => r.email).filter(Boolean);
    } catch (e) {
      console.log('Note: Could not fetch backup email recipients, will use admin emails');
    }

    if (recipientEmails.length === 0) {
      try {
        const admins = await executeQuery(`SELECT email FROM users WHERE role='admin' AND is_active = TRUE`);
        if (admins.success) recipientEmails = admins.data.map(r => r.email).filter(Boolean);
      } catch (e) {
        console.log('Note: Could not fetch admin emails');
      }
    }

    // Send emails
    const stats = fs.statSync(gzFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'assets';
    const systemName = process.env.APP_NAME || process.env.SERVICE_NAME || 'Assets Management System';
    const backupType = 'Manual/Test Backup';
    // Use Africa/Nairobi as default timezone for email formatting
    const emailTimezone = process.env.TZ || 'Africa/Nairobi';
    const formattedDate = now.toLocaleString('en-US', {
      timeZone: emailTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    const subject = `[${systemName}] Database Backup - ${filename}`;
    const text = `DATABASE BACKUP NOTIFICATION\n\nSystem: ${systemName}\nDatabase: ${dbName}\nBackup Type: ${backupType}\n\nBackup Details:\n- File Name: ${filename}\n- File Size: ${fileSizeMB} MB (${fileSizeKB} KB)\n- Created At: ${formattedDate} (${emailTimezone})\n- Timestamp: ${now.toISOString()}\n\nThis backup was triggered manually for testing purposes.\n\nThe backup SQL file is attached to this email.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">📦 Database Backup Notification</h2>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 150px;">System:</td>
              <td style="padding: 8px 0; color: #6b7280;">${systemName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Database:</td>
              <td style="padding: 8px 0; color: #6b7280;">${dbName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Backup Type:</td>
              <td style="padding: 8px 0; color: #6b7280;">${backupType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">File Name:</td>
              <td style="padding: 8px 0; color: #6b7280; font-family: monospace;">${filename}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">File Size:</td>
              <td style="padding: 8px 0; color: #6b7280;">${fileSizeMB} MB (${fileSizeKB} KB)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Created At:</td>
              <td style="padding: 8px 0; color: #6b7280;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Timezone:</td>
              <td style="padding: 8px 0; color: #6b7280;">${emailTimezone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Timestamp (ISO):</td>
              <td style="padding: 8px 0; color: #6b7280; font-family: monospace; font-size: 12px;">${now.toISOString()}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>ℹ️ Note:</strong> This backup was triggered manually for testing purposes.
            </p>
          </div>
          <div style="margin-top: 20px; padding: 12px; background: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>📎 Attachment:</strong> The backup SQL file is attached to this email.
            </p>
          </div>
        </div>
        <div style="background: #f3f4f6; padding: 15px; text-align: center; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            This is an automated backup notification from ${systemName}
          </p>
        </div>
      </div>
    `;

    const fileContent = fs.readFileSync(gzFile);
    for (const email of recipientEmails) {
      try {
        await notificationService.sendEmailNotification(email, subject, html, text, [{
          filename,
          content: fileContent,
          contentType: 'application/gzip'
        }]);
      } catch (emailError) {
        console.error(`Failed to send backup email to ${email}:`, emailError);
      }
    }

    // Log backup creation
    const auditLogger = (await import('../utils/auditLogger.js')).default;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    await auditLogger.logBackup(req.user?.id || null, 'CREATE', filename, {
      filename,
      file_size_mb: fileSizeMB,
      file_size_kb: fileSizeKB,
      recipients: recipientEmails.length,
      backup_type: 'manual_test'
    }, ipAddress, userAgent);

    res.json({
      success: true,
      message: 'Backup created and sent successfully',
      filename,
      recipients: recipientEmails.length
    });
  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      message: error.message || String(error)
    });
  }
});

export default router;


