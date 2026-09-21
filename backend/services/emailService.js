import nodemailer from 'nodemailer';
import { executeQuery } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { wrapEmail, badge as themeBadge, callout, button, paragraph, muted, kindFor } from '../utils/emailTheme.js';

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
    // badgeColor is accepted for backwards compatibility but ignored: the badge
    // colour now comes from the company palette, derived from the badge label.
    // eslint-disable-next-line no-unused-vars
    badgeColor = undefined,
    title = '',
    greetingName = '',
    message = '',
    ctaText = 'View All Notifications',
    ctaUrl = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/notifications',
    brandName = this.brand_name,
    logoCid = undefined,
  }) {
    const safe = (s) => (s || '').toString();
    const bodyHtml = `
      <div style="margin:0 0 4px;">${themeBadge(safe(badge), kindFor(safe(badge)))}</div>
      ${greetingName ? paragraph(`Hello ${safe(greetingName)},`, { margin: '12px 0 12px' }) : ''}
      ${callout(safe(message))}
      ${button(safe(ctaText), safe(ctaUrl))}
      ${muted(`This is an automated notification from the ${safe(brandName)} Assets Management System.`, { margin: '16px 0 0' })}`;
    return wrapEmail({
      title: safe(title),
      preheader: safe(title),
      bodyHtml,
      footerHtml: `<p style="margin:0;">© ${new Date().getFullYear()} ${safe(brandName)}. All rights reserved.</p>`,
    });
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
