import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import db from '../config/database.js';
import notificationService from '../services/notificationService.js';
import { requireAdmin } from '../middleware/auth.js';
import { sanitizePagination } from '../utils/pagination.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../storage/backups');
fs.mkdirSync(storageDir, { recursive: true });

// List available backup files on disk (place BEFORE :id routes to avoid conflict)
router.get('/files', requireAdmin, async (req, res) => {
  try {
    const files = fs.readdirSync(storageDir)
      .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql') || f.endsWith('.json'))
      .map(f => {
        const p = path.join(storageDir, f);
        const stat = fs.statSync(p);
        return { name: f, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => b.modified - a.modified);
    res.json({ files });
  } catch (error) {
    console.error('List backup files error:', error);
    res.status(500).json({ error: 'Failed to list backup files' });
  }
});

// Download a backup file
router.get('/files/:name', requireAdmin, async (req, res) => {
  try {
    const filename = req.params.name;
    const full = path.join(storageDir, filename);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    const contentType = filename.endsWith('.gz') ? 'application/gzip' : filename.endsWith('.json') ? 'application/json' : 'application/sql';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(full).pipe(res);
  } catch (error) {
    console.error('Download backup file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete a backup file
router.delete('/files/:name', requireAdmin, async (req, res) => {
  try {
    const filename = req.params.name;
    const full = path.join(storageDir, filename);
    
    if (!fs.existsSync(full)) {
      return res.status(404).json({ 
        success: false,
        error: 'File not found' 
      });
    }
    
    // Only allow deletion of backup files (security check)
    if (!filename.endsWith('.sql.gz') && !filename.endsWith('.sql') && !filename.endsWith('.json')) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type. Only backup files can be deleted.' 
      });
    }
    
    fs.unlinkSync(full);
    
    res.json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Delete backup file error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete file',
      message: error?.message || String(error)
    });
  }
});

// Get all backups (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page: pageParam = 1, limit: limitParam = 1000, search = '' } = req.query;
    const { limit, offset, page } = sanitizePagination(pageParam, limitParam, {
      defaultLimit: 1000,
      maxLimit: 1000
    });

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = 'WHERE name LIKE ? OR description LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const backupsResult = await executeQuery(
      `SELECT b.*, u.name as created_by_name, u.email as created_by_email
       FROM backups b
       LEFT JOIN users u ON b.created_by = u.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM backups b ${whereClause}`,
      params
    );

    if (!backupsResult.success || !countResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch backups',
        message: 'Database query failed'
      });
    }

    res.json({
      backups: backupsResult.data,
      pagination: {
        page,
        limit,
        total: countResult.data[0].total,
        pages: Math.ceil(countResult.data[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({
      error: 'Failed to fetch backups',
      message: 'An unexpected error occurred'
    });
  }
});

// Get backup by ID (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const backupResult = await executeQuery(
      `SELECT b.*, u.name as created_by_name, u.email as created_by_email
       FROM backups b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = ?`,
      [id]
    );

    if (!backupResult.success || backupResult.data.length === 0) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    res.json({
      backup: backupResult.data[0]
    });
  } catch (error) {
    console.error('Get backup error:', error);
    res.status(500).json({
      error: 'Failed to fetch backup',
      message: 'An unexpected error occurred'
    });
  }
});

// Create backup (admin only)
router.post('/', [
  requireAdmin,
  body('name').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('version').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, description, version } = req.body;

    // Create backup data by exporting all tables
    const backupData = await createBackupData();

    // Generate UUID for the backup (since MySQL insertId doesn't work with UUID primary keys)
    const { randomUUID } = await import('crypto');
    const backupId = randomUUID();

    // Create backup record
    const result = await executeQuery(
      `INSERT INTO backups (id, name, description, timestamp, version, metadata, backup_data, created_by)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        backupId,
        name,
        description || null,
        version || '1.0.0',
        JSON.stringify({ created_by: req.user.name, created_at: new Date().toISOString() }),
        JSON.stringify(backupData),
        req.user.id
      ]
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Backup creation failed',
        message: 'Could not create backup'
      });
    }

    // Get the created backup using the generated UUID
    const backupResult = await executeQuery(
      `SELECT b.*, u.name as created_by_name, u.email as created_by_email
       FROM backups b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = ?`,
      [backupId]
    );

    res.status(201).json({
      message: 'Backup created successfully',
      backup: backupResult.data[0]
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({
      error: 'Backup creation failed',
      message: 'An unexpected error occurred'
    });
  }
});

// Manually trigger a backup and email recipients (admin only)
router.post('/trigger', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const name = `Scheduled Backup ${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;
    const description = 'Automatic backup triggered manually';

    const backupData = await createBackupData();

    // Generate UUID for backup id
    const { randomUUID } = await import('crypto');
    const backupId = randomUUID();

    // Save backup
    const result = await executeQuery(
      `INSERT INTO backups (id, name, description, timestamp, version, metadata, backup_data, created_by)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        backupId,
        name,
        description,
        '1.0.0',
        JSON.stringify({ created_by: req.user?.name || 'system', created_at: now.toISOString() }),
        JSON.stringify(backupData),
        req.user?.id || null
      ]
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to save backup' });
    }

    // Fetch recipient emails
    const recipientsResult = await executeQuery(
      `SELECT email FROM backup_email_recipients WHERE is_active = TRUE`
    );

    let recipientEmails = [];
    if (recipientsResult.success) {
      recipientEmails = recipientsResult.data.map(r => r.email).filter(Boolean);
    }

    // Fallback to admins if no custom recipients
    if (recipientEmails.length === 0) {
      const adminsResult = await executeQuery(
        `SELECT email FROM users WHERE role = 'admin' AND is_active = TRUE`
      );
      if (adminsResult.success) {
        recipientEmails = adminsResult.data.map(r => r.email).filter(Boolean);
      }
    }

    // Prepare JSON attachment
    const attachmentContent = Buffer.from(JSON.stringify(backupData, null, 2));
    const filename = `backup_${now.toISOString().replace(/[:T]/g, '-').split('.')[0]}.json`;

    // Email each recipient
    const subject = `Database Backup - ${name}`;
    const text = `A new database backup has been created.\n\nName: ${name}\nDate: ${now.toLocaleString()}\n\nThe backup JSON file is attached.`;
    const html = `<p>A new database backup has been created.</p><p><strong>Name:</strong> ${name}<br/><strong>Date:</strong> ${now.toLocaleString()}</p><p>The backup JSON file is attached.</p>`;

    for (const email of recipientEmails) {
      try {
        await notificationService.sendEmailNotification(
          email,
          subject,
          html,
          text,
          [{ filename, content: attachmentContent, contentType: 'application/json' }]
        );
      } catch (e) {
        console.error('Backup email send failed for', email, e);
      }
    }

    res.json({ success: true, message: 'Backup created and emails sent', backup_id: backupId });
  } catch (error) {
    console.error('Trigger backup error:', error);
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
});

// Create zipped SQL dump and store to disk, email recipients (admin only)
router.post('/sql', requireAdmin, async (req, res) => {
  try {
    const mysqldump = (await import('mysqldump')).default;

    const now = new Date();
    const ts = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const baseName = `backup_${ts}`;
    const sqlFile = path.join(storageDir, `${baseName}.sql`);
    const gzFile = `${sqlFile}.gz`;

    // Generate SQL dump
    await mysqldump({
      connection: {
        host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME,
        password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
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
    try { fs.unlinkSync(sqlFile); } catch {}

    // Email recipients with attachment
    let recipientEmails = [];
    const rec = await executeQuery(`SELECT email FROM backup_email_recipients WHERE is_active = TRUE`);
    if (rec.success) recipientEmails = rec.data.map(r => r.email).filter(Boolean);
    if (recipientEmails.length === 0) {
      const admins = await executeQuery(`SELECT email FROM users WHERE role='admin' AND is_active = TRUE`);
      if (admins.success) recipientEmails = admins.data.map(r => r.email).filter(Boolean);
    }

    try {
      const attachmentContent = fs.readFileSync(gzFile);
      const stats = fs.statSync(gzFile);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      const dbName = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'assets';
      const systemName = process.env.APP_NAME || process.env.SERVICE_NAME || 'Assets Management System';
      const backupType = 'Manual SQL Backup';
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
      
      const subject = `[${systemName}] SQL Backup - ${baseName}.sql.gz`;
      const text = `DATABASE BACKUP NOTIFICATION\n\nSystem: ${systemName}\nDatabase: ${dbName}\nBackup Type: ${backupType}\n\nBackup Details:\n- File Name: ${baseName}.sql.gz\n- File Size: ${fileSizeMB} MB (${fileSizeKB} KB)\n- Created At: ${formattedDate} (${emailTimezone})\n- Timestamp: ${now.toISOString()}\n\nThis backup was created manually via the admin interface.\n\nThe backup SQL file is attached to this email.`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">📦 SQL Backup Notification</h2>
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
                <td style="padding: 8px 0; color: #6b7280; font-family: monospace;">${baseName}.sql.gz</td>
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
                <strong>ℹ️ Note:</strong> This backup was created manually via the admin interface.
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
      
      for (const email of recipientEmails) {
        await notificationService.sendEmailNotification(email, subject, html, text, [
          { filename: `${baseName}.sql.gz`, content: attachmentContent, contentType: 'application/gzip' }
        ]);
      }
    } catch (e) {
      console.error('Emailing SQL backup failed:', e);
    }

    res.json({ success: true, file: `${baseName}.sql.gz` });
  } catch (error) {
    console.error('SQL dump failed:', error);
    res.status(500).json({ error: 'Failed to create SQL dump' });
  }
});

// List available backup files on disk
router.get('/files', requireAdmin, async (req, res) => {
  try {
    const files = fs.readdirSync(storageDir)
      .filter(f => f.endsWith('.sql.gz') || f.endsWith('.sql') || f.endsWith('.json'))
      .map(f => {
        const p = path.join(storageDir, f);
        const stat = fs.statSync(p);
        return { name: f, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => b.modified - a.modified);
    res.json({ files });
  } catch (error) {
    console.error('List backup files error:', error);
    res.status(500).json({ error: 'Failed to list backup files' });
  }
});

// Download a backup file
router.get('/files/:name', requireAdmin, async (req, res) => {
  try {
    const filename = req.params.name;
    const full = path.join(storageDir, filename);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(full).pipe(res);
  } catch (error) {
    console.error('Download backup file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Restore from existing server file name (.sql.gz)
router.post('/restore-file', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    const full = path.join(storageDir, name);
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });

    let sqlBuffer;
    if (name.endsWith('.gz')) {
      const gz = fs.readFileSync(full);
      sqlBuffer = zlib.gunzipSync(gz);
    } else {
      sqlBuffer = fs.readFileSync(full);
    }

    const sqlText = sqlBuffer.toString('utf8');
    const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
    
    if (DB_CLIENT === 'postgres') {
      // For PostgreSQL, execute SQL statements
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        // Split SQL by semicolons and execute each statement
        const statements = sqlText.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
          if (stmt.trim()) {
            await client.query(stmt.trim());
          }
        }
        await client.query('COMMIT');
        res.json({ success: true, message: 'Database restored successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // For MySQL/MariaDB, use multipleStatements
      const mysql = await import('mysql2/promise');
      const baseConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'assets',
        multipleStatements: true
      };
      const conn = await mysql.createConnection(baseConfig);
      try {
        // Disable FK checks
        await conn.query('SET FOREIGN_KEY_CHECKS=0');
        
        // Get all table names and truncate them (clear existing data)
        const [tables] = await conn.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
          [baseConfig.database]
        );
        
        if (tables.length > 0) {
          // Truncate each table individually (MySQL doesn't support multiple tables in one TRUNCATE)
          for (const table of tables) {
            await conn.query(`TRUNCATE TABLE \`${table.TABLE_NAME}\``);
          }
        }
        
        // Now execute the restore SQL (which will recreate tables and insert data)
        await conn.query(sqlText);
        
        // Re-enable FK checks
        await conn.query('SET FOREIGN_KEY_CHECKS=1');
        res.json({ success: true, message: 'Database restored successfully' });
      } catch (error) {
        // Re-enable FK checks even on error
        await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
        throw error;
      } finally {
        await conn.end();
      }
    }
  } catch (error) {
    console.error('Restore-file error:', error);
    res.status(500).json({ error: 'Failed to restore', message: error?.message || String(error) });
  }
});

// Restore from uploaded .sql, .sql.gz, or .json
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const uploadDir = path.join(storageDir, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const upload = multer({ dest: uploadDir }).single('file');

    upload(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: 'Upload failed', message: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        const uploaded = req.file.path;
        const original = req.file.originalname || '';
        const { clearExisting = false, skipUsers = false, skipNotifications = false } = req.body || {};

        // Check if it's a JSON file
        if (original.endsWith('.json')) {
          // Handle JSON restore
          const jsonContent = fs.readFileSync(uploaded, 'utf8');
          const backupData = JSON.parse(jsonContent);
          
          if (!backupData.tables || typeof backupData.tables !== 'object') {
            throw new Error('Invalid backup file: missing tables object');
          }

          const mysql = await import('mysql2/promise');
          const baseConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'assets',
            multipleStatements: true
          };
          const conn = await mysql.createConnection(baseConfig);

          try {
            await conn.query('SET FOREIGN_KEY_CHECKS=0');
            
            const tableOrder = [
              'departments',
              'users',
              'assets',
              'issues',
              'issue_comments',
              'asset_requests',
              'notifications',
              'user_notification_preferences'
            ];

            // Clear existing data if requested
            if (clearExisting) {
              for (const table of tableOrder.slice().reverse()) {
                try {
                  await conn.query(`TRUNCATE TABLE \`${table}\``);
                } catch (e) {
                  console.warn(`Could not truncate ${table}:`, e.message);
                }
              }
            }

            // Restore data in order
            for (const table of tableOrder) {
              if (skipUsers && table === 'users') continue;
              if (skipNotifications && (table === 'notifications' || table === 'user_notification_preferences')) continue;

              const rows = backupData.tables[table];
              if (!Array.isArray(rows) || rows.length === 0) continue;

              for (const row of rows) {
                const cols = Object.keys(row).filter(k => row[k] !== undefined);
                if (cols.length === 0) continue;
                
                const placeholders = cols.map(() => '?').join(',');
                const updates = cols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
                const values = cols.map(c => row[c]);
                const sql = `INSERT INTO \`${table}\` (\`${cols.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
                
                try {
                  await conn.query(sql, values);
                } catch (e) {
                  console.error(`Error inserting into ${table}:`, e.message);
                  throw e;
                }
              }
            }

            await conn.query('SET FOREIGN_KEY_CHECKS=1');
          } catch (error) {
            await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
            throw error;
          } finally {
            await conn.end();
          }

          try { fs.unlinkSync(uploaded); } catch {}
          res.json({ success: true, message: 'JSON backup restored successfully' });
          return;
        }

        // Handle SQL files (.sql, .sql.gz)
        let sqlBuffer;
        if (original.endsWith('.sql.gz') || original.endsWith('.gz')) {
          // Decompress gzipped SQL file
          const gz = fs.readFileSync(uploaded);
          sqlBuffer = zlib.gunzipSync(gz);
        } else {
          // Plain SQL file
          sqlBuffer = fs.readFileSync(uploaded);
        }

        const sqlText = sqlBuffer.toString('utf8');
        const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();
        
        if (DB_CLIENT === 'postgres') {
          // For PostgreSQL, execute SQL statements
          const client = await db.connect();
          try {
            await client.query('BEGIN');
            const statements = sqlText.split(';').filter(s => s.trim().length > 0);
            for (const stmt of statements) {
              if (stmt.trim()) {
                await client.query(stmt.trim());
              }
            }
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          } finally {
            client.release();
          }
        } else {
          // For MySQL/MariaDB
          const mysql = await import('mysql2/promise');
          const baseConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'assets',
            multipleStatements: true
          };
          const conn = await mysql.createConnection(baseConfig);
          try {
            await conn.query('SET FOREIGN_KEY_CHECKS=0');
            
            // Get all table names and truncate them
            const [tables] = await conn.query(
              "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
              [baseConfig.database]
            );
            
            if (tables.length > 0) {
              // Truncate each table individually
              for (const table of tables) {
                try {
                  await conn.query(`TRUNCATE TABLE \`${table.TABLE_NAME}\``);
                } catch (e) {
                  console.warn(`Could not truncate ${table.TABLE_NAME}:`, e.message);
                }
              }
            }
            
            // Execute the restore SQL
            await conn.query(sqlText);
            
            await conn.query('SET FOREIGN_KEY_CHECKS=1');
          } catch (error) {
            await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
            throw error;
          } finally {
            await conn.end();
          }
        }

        try { fs.unlinkSync(uploaded); } catch {}
        res.json({ success: true, message: 'Database restored successfully' });
      } catch (e) {
        console.error('Restore failed:', e);
        // Clean up uploaded file on error
        try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
        res.status(500).json({ 
          error: 'Restore failed', 
          message: e?.message || String(e),
          stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
      }
    });
  } catch (error) {
    console.error('Restore route error:', error);
    res.status(500).json({ 
      error: 'Failed to restore', 
      message: error?.message || String(error)
    });
  }
});

// Restore JSON backup stored in DB by backup id
router.post('/:id/restore-json', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { clearExisting = false } = req.body || {};

    const backupResult = await executeQuery(
      `SELECT backup_data FROM backups WHERE id = ?`,
      [id]
    );
    if (!backupResult.success || backupResult.data.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    const backupData = backupResult.data[0].backup_data || {};
    const tables = backupData.tables || {};

    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME,
      password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
      multipleStatements: true
    });

    const tableOrder = [
      'departments',
      'users',
      'assets',
      'issues',
      'issue_comments',
      'asset_requests',
      'notifications'
    ];

    const run = async (sql, params=[]) => {
      try { await conn.query(sql, params); } catch (e) { console.error('SQL error:', e.message); throw e; }
    };

    if (clearExisting) {
      for (const t of tableOrder.slice().reverse()) {
        await run(`DELETE FROM ${t}`);
      }
    }

    for (const t of tableOrder) {
      const rows = tables[t];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => '?').join(',');
        const updates = cols.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
        const values = cols.map(c => row[c]);
        const sql = `INSERT INTO ${t} (\`${cols.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
        await run(sql, values);
      }
    }

    await conn.end();
    res.json({ success: true, message: 'JSON backup restored successfully' });
  } catch (error) {
    console.error('Restore JSON by id failed:', error);
    res.status(500).json({ error: 'Failed to restore JSON backup', message: error.message });
  }
});

// Download backup (admin only)
router.get('/:id/download', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const backupResult = await executeQuery(
      'SELECT name, backup_data, created_at FROM backups WHERE id = ?',
      [id]
    );

    if (!backupResult.success || backupResult.data.length === 0) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    const backup = backupResult.data[0];
    const filename = `${backup.name.replace(/[^a-zA-Z0-9]/g, '_')}_${backup.created_at.toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup.backup_data);
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({
      error: 'Failed to download backup',
      message: 'An unexpected error occurred'
    });
  }
});

// Delete backup (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await executeQuery(
      'DELETE FROM backups WHERE id = ?',
      [id]
    );

    if (!result.success || result.data.affectedRows === 0) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    res.json({
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      error: 'Failed to delete backup',
      message: 'An unexpected error occurred'
    });
  }
});

// Helper function to create backup data
async function createBackupData() {
  try {
    const tables = [
      'departments', 'users', 'assets', 'issues', 'issue_comments',
      'asset_maintenance', 'notifications', 'audit_logs', 'asset_requests'
    ];

    const backupData = {};

    for (const table of tables) {
      const result = await executeQuery(`SELECT * FROM ${table}`);
      if (result.success) {
        backupData[table] = result.data;
      }
    }

    return backupData;
  } catch (error) {
    console.error('Error creating backup data:', error);
    throw error;
  }
}

export default router;

