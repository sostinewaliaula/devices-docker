import nodemailer from 'nodemailer';
import { executeQuery } from '../config/database.js';
import fs from 'fs';
import path from 'path';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  async initializeTransporter(force = false) {
    if (this.initialized && !force) return;

    try {
      // Fetch SMTP settings from database
      const settingsResult = await executeQuery(
        'SELECT setting_key, setting_value FROM system_settings WHERE category = ?',
        ['smtp']
      );

      const dbSettings = {};
      if (settingsResult.success && settingsResult.data.length > 0) {
        settingsResult.data.forEach(s => {
          dbSettings[s.setting_key] = s.setting_value;
        });
      }

      const host = dbSettings.smtp_host || process.env.SMTP_HOST;
      const port = parseInt(dbSettings.smtp_port || process.env.SMTP_PORT);
      const user = dbSettings.smtp_user || process.env.SMTP_USER;
      // Don't log password
      const pass = dbSettings.smtp_pass || process.env.SMTP_PASS;
      const secure = (dbSettings.smtp_secure || process.env.SMTP_SECURE) === 'true';

      if (!host || !port || !user || !pass) {
        throw new Error('Missing SMTP configuration (checked both database and environment)');
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      this.smtp_from = dbSettings.smtp_from || process.env.SMTP_FROM || user;
      this.brand_name = dbSettings.brand_name || process.env.BRAND_NAME || 'Caava Group Assets';
      this.email_logo_url = dbSettings.email_logo_url || process.env.EMAIL_LOGO_URL;

      // Explicitly format from address with brand name as display name
      if (this.brand_name && this.smtp_from) {
        // Extract email only if it's already in "Name <email@..." format
        const emailMatch = this.smtp_from.match(/<([^>]+)>|([^\s<]+@[^\s>]+)/);
        const emailOnly = emailMatch ? (emailMatch[1] || emailMatch[2]) : this.smtp_from;
        this.smtp_from = `"${this.brand_name}" <${emailOnly}>`;
      }

      this.initialized = true;
      console.log('Email service initialized with SMTP:', host);
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.initialized = false;
    }
  }

  async sendPasswordResetEmail(email, name, resetCode) {
    try {
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      // Get email template from database
      const templateResult = await executeQuery(
        'SELECT subject, body FROM email_templates WHERE name = ? AND is_active = TRUE',
        ['password_reset']
      );

      if (!templateResult.success || templateResult.data.length === 0) {
        throw new Error('Email template not found');
      }

      const template = templateResult.data[0];
      const subject = template.subject;
      const messageHtml = template.body
        .replace(/\{\{user_name\}\}/g, name)
        .replace(/\{\{reset_code\}\}/g, resetCode);

      // Use branded renderer for modern look
      const result = await this.sendBrandedNotificationEmail(
        email,
        subject,
        {
          badge: 'INFO',
          badgeColor: '#0ea5e9',
          title: 'Password Reset Code',
          greetingName: name || '',
          message: messageHtml,
          ctaText: 'Reset Password',
          ctaUrl: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/reset-password'
        }
      );
      if (!result.success) throw new Error(result.error || 'Failed sending email');
      console.log('Password reset email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationEmail(email, subject, message) {
    try {
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: this.smtp_from,
        to: email,
        subject: subject,
        text: message.replace(/<[^>]*>?/gm, ''), // Basic text version
        html: message
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Notification email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send notification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Render a modern branded HTML email
  renderBrandedEmail({
    badge = 'INFO',
    badgeColor = '#0ea5e9',
    title = '',
    greetingName = '',
    message = '',
    ctaText = 'View All Notifications',
    ctaUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/notifications',
    brandName = this.brand_name,
    logoCid = undefined,
  }) {
    const safe = (s) => (s || '').toString();
    const logoUrl = process.env.EMAIL_LOGO_URL || '';
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safe(title)}</title>
  <style>
    .container { max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 24px rgba(2,6,23,0.08); }
    .header { background: linear-gradient(135deg, #5b7ddd 0%, #6a50d8 100%); padding: 28px 32px; color: #fff; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 24px; }
    .subtitle { opacity: 0.9; font-size: 14px; margin-top: 4px; }
    .body { padding: 28px 32px; color: #0f172a; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; font-weight: 600; font-size: 12px; color: #0f172a; background: #e2f2ff; border: 1px solid #bae6fd; }
    .title { margin: 16px 0 8px; font-size: 22px; font-weight: 800; }
    .greeting { color: #334155; margin-bottom: 12px; }
    .card { border-left: 4px solid ${badgeColor}; background: #f8fafc; padding: 16px; border-radius: 8px; }
    .cta { margin-top: 20px; }
    .button { display: inline-block; padding: 12px 18px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 700; }
    .muted { color: #64748b; font-size: 12px; margin-top: 16px; }
    .footer { color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px; padding-bottom: 16px; }
  </style>
</head>
<body style="background:#f1f5f9;padding:24px;">
  <div class="container">
    <div class="body">
      <div class="badge" style="background:${badgeColor}1a;border-color:${badgeColor}55;color:#0f172a;">${safe(badge)}</div>
      <div class="title">${safe(title)}</div>
      ${greetingName ? `<div class="greeting">Hello ${safe(greetingName)},</div>` : ''}
      <div class="card">${safe(message)}</div>
      <div class="cta"><a class="button" href="${safe(ctaUrl)}" target="_blank" rel="noopener">${safe(ctaText)}</a></div>
      <div class="muted">This is an automated notification from the ${safe(brandName)} Assets Management System.</div>
      <div class="footer">© ${new Date().getFullYear()} ${safe(brandName)}. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;
  }

  async sendBrandedNotificationEmail(to, subject, options) {
    try {
      await this.initializeTransporter();
      if (!this.transporter) throw new Error('Email service not initialized');

      // Compute logo path and decide whether to embed
      let attachments = [];
      let logoCid;
      const embedLogoPreference = options.embedLogo !== false && (process.env.EMAIL_LOGO_EMBED !== 'false');
      if (embedLogoPreference) {
        try {
          const moduleDir = path.dirname(new URL(import.meta.url).pathname);
          const projectRoot = path.resolve(moduleDir, '..', '..');
          const frontendLogoPath = path.resolve(projectRoot, 'src', 'assets', 'logo.png');
          const backendPublicLogoPath = path.resolve(projectRoot, 'backend', 'public', 'email-assets', 'logo.png');
          const backendAssetsLogoPath = path.resolve(projectRoot, 'backend', 'assets', 'logo.png');
          const backendSrcAssetsLogoPath = path.resolve(projectRoot, 'backend', 'src', 'assets', 'logo.png');
          const backendAssetsImagesLogoPath = path.resolve(projectRoot, 'backend', 'assets', 'images', 'logo.png');
          const envLogoPath = process.env.EMAIL_LOGO_PATH ? path.resolve(projectRoot, process.env.EMAIL_LOGO_PATH) : null;
          const logoPath = envLogoPath && fs.existsSync(envLogoPath)
            ? envLogoPath
            : (fs.existsSync(backendPublicLogoPath)
              ? backendPublicLogoPath
              : (fs.existsSync(backendAssetsLogoPath)
                ? backendAssetsLogoPath
                : (fs.existsSync(backendSrcAssetsLogoPath)
                  ? backendSrcAssetsLogoPath
                  : (fs.existsSync(backendAssetsImagesLogoPath)
                    ? backendAssetsImagesLogoPath
                    : (fs.existsSync(frontendLogoPath) ? frontendLogoPath : null)))));
          if (logoPath) {
            logoCid = 'logo@caava';
            attachments.push({ filename: path.basename(logoPath), path: logoPath, cid: logoCid });
          }
        } catch (e) {
          console.warn('Email logo embedding skipped:', e.message);
        }
      }

      const html = this.renderBrandedEmail({ ...options, logoCid });
      const text = (options.message || '').replace(/<[^>]*>?/gm, '');

      const mailOptions = {
        from: this.smtp_from,
        to,
        subject,
        text,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Branded notification email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send branded notification email:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnection() {
    try {
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return { success: true };
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();
