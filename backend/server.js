import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import departmentRoutes from './routes/departments.js';
import assetRoutes from './routes/assets.js';
import issueRoutes from './routes/issues.js';
import notificationRoutes from './routes/notifications.js';
import commentRoutes from './routes/comments.js';
import auditRoutes from './routes/audit.js';
import backupRoutes from './routes/backups.js';
import backupScheduleRoutes from './routes/backup-schedule.js';
import backupEmailRecipientsRoutes from './routes/backup-email-recipients.js';
import assetRequestRoutes from './routes/asset-requests.js';
import managerRoutes from './routes/manager.js';
import notificationPreferencesRoutes from './routes/notification-preferences.js';
import mfaRoutes from './routes/mfa.js';
import adminMfaRoutes from './routes/admin-mfa.js';
import mfaPolicyRoutes from './routes/mfa-policies.js';
import exportRoutes from './routes/exports.js';
import weeklyNotificationRoutes from './routes/weekly-notifications.js';
import budgetRoutes from './routes/budget.js';
import positionsRoutes from './routes/positions.js';
import assetTypeRoutes from './routes/assetTypes.js';
import assetRequestTypeRoutes from './routes/assetRequestTypes.js';
import issueCategoryRoutes from './routes/issueCategories.js';
import settingsRoutes from './routes/settings.js';
import dropdownOptionsRoutes from './routes/dropdownOptions.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/auth.js';
import { executeQuery } from './config/database.js';
import { sanitizePagination } from './utils/pagination.js';

// Import services
import notificationService from './services/notificationService.js';

// Import cron scheduler
import cron from 'node-cron';

// Load environment variables
dotenv.config();

const MYSQL_DATABASE = process.env.DB_NAME || 'assets';
const app = express();
const PORT = process.env.PORT || 3000;
const configuredFrontendOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || '').split(',')
]
  .map(origin => origin?.trim())
  .filter(Boolean);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:5010',
    'http://localhost:5011',
    'http://localhost:5012',
    'https://it-assets.caavagroup.com',
    'https://devices.sostinewaliaula.site',
    ...configuredFrontendOrigins
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/settings', settingsRoutes);

// Public endpoint for getting departments (needed for registration)
app.get('/api/departments', async (req, res) => {
  try {
    const { page: pageParam = 1, limit: limitParam = 1000, search = '' } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = 'WHERE name LIKE ? OR location LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const departmentsResult = await executeQuery(
      `SELECT d.*, 
              COALESCE(u.name, 'Unassigned') as manager,
              COALESCE(user_counts.user_count, 0) as user_count,
              COALESCE(asset_counts.asset_count, 0) as asset_count,
              COALESCE(asset_counts.asset_value, 0) as asset_value
       FROM departments d
       LEFT JOIN users u ON d.manager_id = u.id
       LEFT JOIN (
         SELECT department_id, COUNT(*) as user_count
         FROM users 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) user_counts ON d.id = user_counts.department_id
       LEFT JOIN (
         SELECT department_id, 
                COUNT(*) as asset_count,
                COALESCE(SUM(COALESCE(NULLIF(current_value, 0), purchase_price, 0)), 0) as asset_value
         FROM assets 
         WHERE department_id IS NOT NULL
         GROUP BY department_id
       ) asset_counts ON d.id = asset_counts.department_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM departments d ${whereClause}`,
      params
    );

    if (!departmentsResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch departments',
        message: 'Database query failed'
      });
    }

    res.json({
      departments: departmentsResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      error: 'Failed to fetch departments',
      message: 'An unexpected error occurred'
    });
  }
});

// Protected routes for departments (POST, PUT, DELETE require auth)
app.use('/api/departments', authenticateToken, departmentRoutes);
app.use('/api/assets', authenticateToken, assetRoutes);
app.use('/api/issues', authenticateToken, issueRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/comments', authenticateToken, commentRoutes);
app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/backups', authenticateToken, backupRoutes);
app.use('/api/backup', backupScheduleRoutes);
app.use('/api/backup-email-recipients', authenticateToken, backupEmailRecipientsRoutes);
app.use('/api/asset-requests', authenticateToken, assetRequestRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/notification-preferences', authenticateToken, notificationPreferencesRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/admin', adminMfaRoutes);
app.use('/api/mfa-policies', mfaPolicyRoutes);
app.use('/api/exports', authenticateToken, exportRoutes);
app.use('/api/weekly-notifications', weeklyNotificationRoutes);
app.use('/api/budget', authenticateToken, budgetRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/asset-types', authenticateToken, assetTypeRoutes);
app.use('/api/asset-request-types', assetRequestTypeRoutes);
app.use('/api/issue-categories', issueCategoryRoutes);
app.use('/api/dropdown-options', authenticateToken, dropdownOptionsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

// Ensure system_settings table exists on startup
async function ensureSystemSettingsTable() {
  try {
    const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
    if (DB_CLIENT === 'postgres') {
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS system_settings (
          setting_key TEXT PRIMARY KEY,
          setting_value TEXT NOT NULL,
          description TEXT,
          category VARCHAR(50),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        []
      );
    } else {
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
    }
  } catch (error) {
    console.error('Failed to create system_settings table:', error.message);
  }
}

// Ensure backup_email_recipients table exists on startup
async function ensureBackupEmailRecipientsTable() {
  try {
    const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
    if (DB_CLIENT === 'postgres') {
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS backup_email_recipients (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255),
          role VARCHAR(100) DEFAULT 'recipient',
          is_active BOOLEAN DEFAULT true,
          added_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        []
      );
      await executeQuery(
        `CREATE INDEX IF NOT EXISTS idx_backup_email_recipients_email ON backup_email_recipients(email)`,
        []
      );
      await executeQuery(
        `CREATE INDEX IF NOT EXISTS idx_backup_email_recipients_active ON backup_email_recipients(is_active)`,
        []
      );
    } else {
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS backup_email_recipients (
          id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255),
          role VARCHAR(100) DEFAULT 'recipient',
          is_active TINYINT(1) DEFAULT 1,
          added_by CHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_backup_email_recipients_email (email),
          INDEX idx_backup_email_recipients_active (is_active),
          INDEX idx_backup_email_recipients_added_by (added_by)
        )`,
        []
      );
      // Add foreign key constraint separately to avoid issues if users table doesn't exist yet
      try {
        const constraintName = 'fk_backup_email_recipients_added_by';
        const constraintCheckResult = await executeQuery(
          `SELECT CONSTRAINT_NAME 
             FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'backup_email_recipients'
              AND CONSTRAINT_NAME = ?`,
          [MYSQL_DATABASE, constraintName]
        );

        const constraintExists = constraintCheckResult.success && constraintCheckResult.data.length > 0;

        if (!constraintExists) {
          const result = await executeQuery(
            `ALTER TABLE backup_email_recipients 
             ADD CONSTRAINT ${constraintName} 
             FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL`,
            []
          );

          if (!result.success) {
            // console.log('Note: Could not add foreign key constraint for added_by (this is OK if users table uses different ID format)');
          }
        }
      } catch (fkError) {
        // console.log('Note: Could not verify/add foreign key constraint for added_by:', fkError.message);
      }
    }
  } catch (error) {
    console.error('Failed to create backup_email_recipients table:', error.message);
  }
}

// Initialize system and start cron jobs
async function ensureAuditLogsTable() {
  try {
    const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
    if (DB_CLIENT === 'postgres') {
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(255),
          details JSONB DEFAULT '{}'::jsonb,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          INDEX idx_audit_user (user_id),
          INDEX idx_audit_action (action),
          INDEX idx_audit_entity (entity_type, entity_id),
          INDEX idx_audit_created (created_at DESC)
        )`,
        []
      );
    } else {
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id CHAR(36),
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(255),
          details JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_user (user_id),
          INDEX idx_audit_action (action),
          INDEX idx_audit_entity (entity_type, entity_id),
          INDEX idx_audit_created (created_at DESC),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )`,
        []
      );
    }
    // console.log('✅ Audit logs table ensured');
  } catch (error) {
    console.error('Failed to create audit_logs table:', error.message);
  }
}

async function initializeSystem() {
  // Ensure required tables exist before setting up cron jobs
  await ensureSystemSettingsTable();
  await ensureBackupEmailRecipientsTable();
  await ensureAuditLogsTable();

  // Setup cron jobs
  setupWeeklyNotificationCrons();
  setupBackupCrons();
}

// Start initialization
initializeSystem().catch(error => {
  console.error('Failed to initialize system:', error);
});

// Function to get weekly notification schedule
async function getWeeklyNotificationSchedule() {
  try {
    const result = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'weekly_notification_schedule'`,
      []
    );

    if (!result.success || result.data.length === 0) {
      // Default schedule: Monday at 9:00 AM
      return {
        enabled: true,
        days: [1], // Monday
        time: '09:00',
        timezone: process.env.TZ || 'Africa/Nairobi'
      };
    }

    try {
      return JSON.parse(result.data[0].setting_value);
    } catch (parseError) {
      return {
        enabled: true,
        days: [1],
        time: '09:00',
        timezone: process.env.TZ || 'Africa/Nairobi'
      };
    }
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return {
      enabled: true,
      days: [1],
      time: '09:00',
      timezone: process.env.TZ || 'Africa/Nairobi'
    };
  }
}

// Function to check if notification should run today
async function shouldRunNotificationToday() {
  const schedule = await getWeeklyNotificationSchedule();

  if (!schedule.enabled) {
    return false;
  }

  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  return schedule.days.includes(today);
}

// Function to setup and manage cron jobs for weekly notifications
let weeklyNotificationCrons = [];

async function setupWeeklyNotificationCrons() {
  // Stop existing cron jobs
  weeklyNotificationCrons.forEach(cron => cron.stop());
  weeklyNotificationCrons = [];

  const schedule = await getWeeklyNotificationSchedule();

  if (!schedule.enabled) {
    // console.log('📅 Weekly notifications are disabled');
    return;
  }

  const [hours, minutes] = schedule.time.split(':').map(Number);
  const timezone = schedule.timezone || process.env.TZ || 'Africa/Nairobi';

  // Create a cron job for each selected day
  schedule.days.forEach(day => {
    // Cron format: minute hour day-of-month month day-of-week
    // day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const cronExpression = `${minutes} ${hours} * * ${day}`;

    const cronJob = cron.schedule(cronExpression, async () => {
      // console.log(`📅 Weekly notification cron job triggered (Day: ${day})`);
      try {
        const result = await notificationService.sendWeeklySummaryToAdmins();
        if (result.success) {
          // console.log('✅ Weekly summary notifications sent successfully');
          // console.log(`📊 Stats: ${result.stats.unresolvedIssues} issues, ${result.stats.pendingRequests} requests, ${result.stats.adminsNotified} admins notified`);
        } else {
          console.error('❌ Weekly summary notification failed:', result.message);
        }
      } catch (error) {
        console.error('❌ Error in weekly notification cron job:', error);
      }
    }, {
      scheduled: true,
      timezone: timezone
    });

    weeklyNotificationCrons.push(cronJob);
    console.log(`📅 Weekly notification scheduled for day ${day} at ${schedule.time} (${timezone})`);
  });

  console.log(`📅 Weekly notification cron jobs set up for ${schedule.days.length} day(s)`);
}

// Backup scheduling
async function getBackupSchedule() {
  try {
    const result = await executeQuery(`SELECT setting_value FROM system_settings WHERE setting_key = 'backup_schedule'`, []);
    if (!result.success || result.data.length === 0) {
      return { enabled: true, days: [1], time: '02:00', timezone: process.env.TZ || 'UTC' };
    }
    return JSON.parse(result.data[0].setting_value);
  } catch {
    return { enabled: true, days: [1], time: '02:00', timezone: process.env.TZ || 'UTC' };
  }
}

let backupCrons = [];
async function setupBackupCrons() {
  backupCrons.forEach(c => c.stop());
  backupCrons = [];
  const schedule = await getBackupSchedule();
  if (!schedule.enabled) return;
  const [hh, mm] = schedule.time.split(':').map(Number);
  const tz = schedule.timezone || process.env.TZ || 'Africa/Nairobi';
  const { randomUUID } = await import('crypto');

  // helper to run backup
  const runBackup = async () => {
    try {
      const now = new Date();
      const name = `Scheduled Backup ${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;
      const description = 'Automatic scheduled backup';

      // Build backup data (same as in backups route)
      const tables = ['departments', 'users', 'assets', 'issues', 'issue_comments', 'asset_maintenance', 'notifications', 'audit_logs', 'asset_requests'];
      const backupData = {};
      for (const table of tables) {
        const r = await executeQuery(`SELECT * FROM ${table}`);
        if (r.success) backupData[table] = r.data;
      }

      const backupId = randomUUID();
      await executeQuery(
        `INSERT INTO backups (id, name, description, timestamp, version, metadata, backup_data, created_by)
         VALUES (?, ?, ?, NOW(), ?, ?, ?, NULL)`,
        [backupId, name, description, '1.0.0', JSON.stringify({ created_by: 'system', created_at: now.toISOString() }), JSON.stringify(backupData)]
      );

      // Fetch recipients
      let recipientEmails = [];
      const rec = await executeQuery(`SELECT email FROM backup_email_recipients WHERE is_active = TRUE`);
      if (rec.success) recipientEmails = rec.data.map(r => r.email).filter(Boolean);
      if (recipientEmails.length === 0) {
        const admins = await executeQuery(`SELECT email FROM users WHERE role='admin' AND is_active = TRUE`);
        if (admins.success) recipientEmails = admins.data.map(r => r.email).filter(Boolean);
      }

      // Send emails with JSON attachment using notificationService
      const { default: notificationService } = await import('./services/notificationService.js');
      const attachmentContent = Buffer.from(JSON.stringify(backupData, null, 2));
      const filename = `backup_${now.toISOString().replace(/[:T]/g, '-').split('.')[0]}.json`;
      const fileSizeMB = (attachmentContent.length / (1024 * 1024)).toFixed(2);
      const fileSizeKB = (attachmentContent.length / 1024).toFixed(2);
      const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'assets';
      const systemName = process.env.APP_NAME || process.env.SERVICE_NAME || 'Assets Management System';
      const backupType = 'Scheduled Automatic Backup';
      // Use the backup schedule's timezone, or default to Africa/Nairobi
      const emailTimezone = schedule.timezone || process.env.TZ || 'Africa/Nairobi';
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

      // Count tables and records
      const tableCount = Object.keys(backupData).length;
      const totalRecords = Object.values(backupData).reduce((sum, table) => sum + (Array.isArray(table) ? table.length : 0), 0);

      const subject = `[${systemName}] Scheduled Backup - ${name}`;
      const text = `DATABASE BACKUP NOTIFICATION\n\nSystem: ${systemName}\nDatabase: ${dbName}\nBackup Type: ${backupType}\n\nBackup Details:\n- Backup Name: ${name}\n- File Name: ${filename}\n- File Size: ${fileSizeMB} MB (${fileSizeKB} KB)\n- Tables Backed Up: ${tableCount}\n- Total Records: ${totalRecords}\n- Created At: ${formattedDate} (${emailTimezone})\n- Timestamp: ${now.toISOString()}\n\nThis backup was automatically created by the scheduled backup system.\n\nThe backup JSON file is attached to this email.`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">📦 Scheduled Backup Notification</h2>
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
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Backup Name:</td>
                <td style="padding: 8px 0; color: #6b7280;">${name}</td>
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
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Tables Backed Up:</td>
                <td style="padding: 8px 0; color: #6b7280;">${tableCount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Total Records:</td>
                <td style="padding: 8px 0; color: #6b7280;">${totalRecords.toLocaleString()}</td>
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
            <div style="margin-top: 20px; padding: 12px; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>✅ Automated:</strong> This backup was automatically created by the scheduled backup system.
              </p>
            </div>
            <div style="margin-top: 20px; padding: 12px; background: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>📎 Attachment:</strong> The backup JSON file is attached to this email.
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

      for (const email of recipientEmails) {
        try {
          await notificationService.sendEmailNotification(email, subject, html, text, [{ filename, content: attachmentContent, contentType: 'application/json' }]);
        } catch { }
      }
      console.log(`✅ Scheduled backup completed and emailed to ${recipientEmails.length} recipient(s)`);

      // Log backup creation
      const auditLogger = (await import('./utils/auditLogger.js')).default;
      await auditLogger.logBackup(null, 'CREATE', backupId, {
        name,
        filename,
        tables_backed_up: tableCount,
        total_records: totalRecords,
        file_size_mb: fileSizeMB,
        recipients: recipientEmails.length
      });
    } catch (err) {
      console.error('❌ Scheduled backup failed:', err);
    }
  };

  schedule.days.forEach(day => {
    const expr = `${mm} ${hh} * * ${day}`;
    const job = cron.schedule(expr, runBackup, { scheduled: true, timezone: tz });
    backupCrons.push(job);
  });
}

// Also check daily if we should run (as a fallback)
const dailyCheckCron = cron.schedule('0 0 * * *', async () => {
  // Check every day at midnight if we should send notifications
  const shouldRun = await shouldRunNotificationToday();
  if (shouldRun) {
    const schedule = await getWeeklyNotificationSchedule();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const now = new Date();

    // If it's the scheduled time, send notifications
    if (now.getHours() === hours && now.getMinutes() === minutes) {
      console.log('📅 Daily check triggered weekly notification');
      try {
        const result = await notificationService.sendWeeklySummaryToAdmins();
        if (result.success) {
          console.log('✅ Weekly summary notifications sent successfully');
        }
      } catch (error) {
        console.error('❌ Error in daily check notification:', error);
      }
    }
  }
}, {
  scheduled: true,
  timezone: process.env.TZ || 'UTC'
});

// Manual trigger endpoint for testing weekly notifications (admin only)
app.post('/api/admin/weekly-summary', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await executeQuery(
      'SELECT role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!userResult.success || userResult.data.length === 0 || userResult.data[0].role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can trigger weekly summaries'
      });
    }

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Display cron job status
  if (weeklyNotificationCrons.length > 0) {
    console.log(`📅 Weekly notification cron jobs scheduled (${weeklyNotificationCrons.length} job(s))`);
  } else {
    console.log('⚠️ Weekly notification cron jobs not started');
  }
});

export default app;

