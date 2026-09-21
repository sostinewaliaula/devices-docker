import { supabase } from '../lib/supabase';
import { EMAIL_PALETTE, EMAIL_THEME } from '../config/emailConfig';

export interface EmailNotificationData {
  userId: string;
  userEmail: string;
  userName: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  notificationId: string;
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export class EmailNotificationService {
  private static instance: EmailNotificationService;
  
  private constructor() {}
  
  public static getInstance(): EmailNotificationService {
    if (!EmailNotificationService.instance) {
      EmailNotificationService.instance = new EmailNotificationService();
    }
    return EmailNotificationService.instance;
  }

  async sendNotificationEmail(data: EmailNotificationData): Promise<boolean> {
    try {
      
      const template = this.createEmailTemplate(data);
      
      const { error } = await supabase.functions.invoke('send-email-notification', {
        body: {
          to: data.userEmail,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody,
          notificationId: data.notificationId,
          userId: data.userId
        }
      });

      if (error) {
        return false;
      }

      return true;
    } catch (error: any) {
      return false;
    }
  }

  async sendBulkNotifications(notifications: EmailNotificationData[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        const result = await this.sendNotificationEmail(notification);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  }

  async testEmailSending(): Promise<{ success: boolean; error?: string }> {
    try {
      const testData: EmailNotificationData = {
        userId: 'test-user-id',
        userEmail: 'test@example.com',
        userName: 'Test User',
        title: 'Test Email Notification',
        message: 'This is a test email to verify the email notification system is working correctly.',
        type: 'info',
        notificationId: 'test-' + Date.now()
      };

      const result = await this.sendNotificationEmail(testData);
      
      if (result) {
        return { success: true };
      } else {
        return { success: false, error: 'Email sending failed' };
      }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  async checkEmailConfiguration(): Promise<{
    smtpConfigured: boolean;
    edgeFunctionAccessible: boolean;
    userPreferences: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let smtpConfigured = false;
    let edgeFunctionAccessible = false;
    let userPreferences = false;

    try {
      smtpConfigured = await this.isEmailEnabled();
      if (!smtpConfigured) {
        errors.push('SMTP configuration is incomplete or disabled');
      }

      try {
        const { error } = await supabase.functions.invoke('send-email-notification', {
          body: {
            to: 'test@example.com',
            subject: 'Test',
            htmlBody: '<p>Test</p>',
            textBody: 'Test',
            notificationId: 'test',
            userId: 'test'
          }
        });
        
        if (error) {
          errors.push(`Edge Function error: ${error.message}`);
        } else {
          edgeFunctionAccessible = true;
        }
      } catch (funcError) {
        errors.push(`Edge Function not accessible: ${funcError instanceof Error ? funcError.message : String(funcError)}`);
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prefs } = await supabase.rpc('get_user_notification_preferences', {
            target_user: user.id
          });
          userPreferences = !!prefs;
          if (!prefs) {
            errors.push('User notification preferences not found');
          }
        }
              } catch (prefError) {
          errors.push(`User preferences error: ${prefError instanceof Error ? prefError.message : String(prefError)}`);
        }

          } catch (error) {
        errors.push(`Configuration check error: ${error instanceof Error ? error.message : String(error)}`);
      }

    return {
      smtpConfigured,
      edgeFunctionAccessible,
      userPreferences,
      errors
    };
  }

  private createEmailTemplate(data: EmailNotificationData): EmailTemplate {
    const baseSubject = `[Caava Group] ${data.title}`;
    
    // Solid company palette, light + dark (see src/config/emailConfig.ts).
    // Light colours are inline (works everywhere); the <style> block flips them
    // with !important inside prefers-color-scheme: dark. Gmail ignores that media
    // query and auto-inverts instead, so every coloured block also carries an
    // explicit bgcolor/background-color.
    const L = EMAIL_THEME.light;
    const D = EMAIL_THEME.dark;
    const badgeColors: Record<EmailNotificationData['type'], { bg: string; fg: string }> = {
      success: { bg: EMAIL_PALETTE.green, fg: EMAIL_PALETTE.navy },
      error: { bg: EMAIL_PALETTE.red, fg: EMAIL_PALETTE.white },
      warning: { bg: EMAIL_PALETTE.orange, fg: EMAIL_PALETTE.navy },
      info: { bg: EMAIL_PALETTE.navy, fg: EMAIL_PALETTE.white },
    };
    const badge = badgeColors[data.type] || badgeColors.info;
    const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const notificationsUrl = `${window.location.origin}/notifications`;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${data.title}</title>
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    table { border-collapse: collapse; }
    @media (prefers-color-scheme: dark) {
      .em-page { background-color: ${D.page} !important; }
      .em-card { background-color: ${D.card} !important; border-color: ${D.border} !important; }
      .em-header { background-color: ${D.header} !important; color: ${D.headerText} !important; border-top-color: ${D.headerBorder} !important; }
      .em-title, .em-subtitle { color: ${D.headerText} !important; }
      .em-body { background-color: ${D.card} !important; color: ${D.text} !important; }
      .em-text { color: ${D.text} !important; }
      .em-muted { color: ${D.muted} !important; }
      .em-h { color: ${D.heading} !important; }
      .em-callout { background-color: ${D.calloutBg} !important; color: ${D.calloutText} !important; }
      .em-btn-td { background-color: ${D.btnBg} !important; }
      .em-btn { background-color: ${D.btnBg} !important; color: ${D.btnText} !important; }
      .em-badge-info { background-color: ${EMAIL_PALETTE.gold} !important; color: ${EMAIL_PALETTE.navy} !important; }
      .em-footer { background-color: ${D.footerBg} !important; color: ${D.muted} !important; border-color: ${D.border} !important; }
    }
    [data-ogsb] .em-page { background-color: ${D.page} !important; }
    [data-ogsb] .em-card, [data-ogsb] .em-body { background-color: ${D.card} !important; }
    [data-ogsb] .em-header { background-color: ${D.header} !important; }
    [data-ogsb] .em-callout { background-color: ${D.calloutBg} !important; }
    [data-ogsb] .em-btn-td, [data-ogsb] .em-btn { background-color: ${D.btnBg} !important; }
    [data-ogsb] .em-footer { background-color: ${D.footerBg} !important; }
    [data-ogsc] .em-title, [data-ogsc] .em-subtitle { color: ${D.headerText} !important; }
    [data-ogsc] .em-text, [data-ogsc] .em-body { color: ${D.text} !important; }
    [data-ogsc] .em-muted, [data-ogsc] .em-footer { color: ${D.muted} !important; }
    [data-ogsc] .em-h { color: ${D.heading} !important; }
    [data-ogsc] .em-callout { color: ${D.calloutText} !important; }
    [data-ogsc] .em-btn { color: ${D.btnText} !important; }
  </style>
</head>
<body class="em-page" bgcolor="${L.page}" style="margin:0;padding:0;background-color:${L.page};font-family:${font};">
<table role="presentation" class="em-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" style="background-color:${L.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="em-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.card}" style="width:100%;max-width:600px;background-color:${L.card};border:1px solid ${L.border};border-radius:10px;">
    <tr><td class="em-header" bgcolor="${L.header}" style="padding:24px 32px;background-color:${L.header};color:${L.headerText};border-top:3px solid ${L.headerBorder};border-radius:10px 10px 0 0;font-family:${font};">
      <img src="https://i.ibb.co/jZfnmhdg/logo.png" alt="Caava Group" style="display:block;height:40px;border:0;">
      <h1 class="em-title" style="margin:10px 0 0 0;font-size:24px;line-height:1.3;font-weight:800;color:${L.headerText};">Caava Group</h1>
      <p class="em-subtitle" style="margin:5px 0 0 0;font-size:14px;color:${L.headerText};">Devices Management System</p>
    </td></tr>
    <tr><td class="em-body" bgcolor="${L.card}" style="padding:28px 32px;background-color:${L.card};color:${L.text};font-family:${font};font-size:15px;line-height:1.6;">
      <span class="em-badge-${data.type}" style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;background-color:${badge.bg};color:${badge.fg};">${data.type}</span>
      <h2 class="em-h" style="margin:20px 0 10px 0;font-size:20px;color:${L.heading};">${data.title}</h2>
      <p class="em-text" style="margin:0 0 15px 0;color:${L.text};">Hello ${data.userName},</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="em-callout" bgcolor="${L.calloutBg}" style="padding:14px 16px;background-color:${L.calloutBg};color:${L.calloutText};border-left:4px solid ${EMAIL_PALETTE.orange};border-radius:4px;line-height:1.6;">${data.message}</td>
      </tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0 0;"><tr>
        <td class="em-btn-td" bgcolor="${L.btnBg}" style="background-color:${L.btnBg};border-radius:6px;">
          <a class="em-btn" href="${notificationsUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:${L.btnText};background-color:${L.btnBg};text-decoration:none;border-radius:6px;">View All Notifications</a>
        </td>
      </tr></table>
      <p class="em-muted" style="margin:15px 0 0 0;font-size:12px;color:${L.muted};">
        This is an automated notification from the Caava Group Devices Management System.
      </p>
    </td></tr>
    <tr><td class="em-footer" bgcolor="${L.footerBg}" align="center" style="padding:20px 32px;background-color:${L.footerBg};color:${L.muted};border-top:1px solid ${L.border};border-radius:0 0 10px 10px;font-family:${font};font-size:12px;line-height:1.5;text-align:center;">
      <p style="margin:0 0 6px;">© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>
      <p style="margin:0;">If you have any questions, please contact your system administrator.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

    const textBody = `
Caava Group - Devices Management System

${data.title.toUpperCase()}

Hello ${data.userName},

${data.message}

View all notifications: ${window.location.origin}/notifications

---
This is an automated notification from the Caava Group Devices Management System.
© ${new Date().getFullYear()} Caava Group. All rights reserved.
    `;

    return {
      subject: baseSubject,
      htmlBody,
      textBody
    };
  }

  async isEmailEnabled(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserEmailPreferences(_userId: string): Promise<{
    emailNotifications: boolean;
    notificationTypes: string[];
  }> {
    try {
      return {
        emailNotifications: true,
        notificationTypes: ['success', 'error', 'warning', 'info']
      };
    } catch (error) {
      return {
        emailNotifications: true,
        notificationTypes: ['success', 'error', 'warning', 'info']
      };
    }
  }
}

// Export singleton instance
export const emailNotificationService = EmailNotificationService.getInstance();
