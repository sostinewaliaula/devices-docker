import { supabase } from '../lib/supabase';

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
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .notification-type { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .type-success { background: #d4edda; color: #155724; }
          .type-error { background: #f8d7da; color: #721c24; }
          .type-warning { background: #fff3cd; color: #856404; }
          .type-info { background: #d1ecf1; color: #0c5460; }
          .footer { text-align: center; margin-top: 20px; padding: 20px; color: #6c757d; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://i.ibb.co/jZfnmhdg/logo.png" alt="Caava Group" style="height: 40px;" />
            <h1 style="margin: 10px 0 0 0; font-size: 24px;">Caava Group</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Devices Management System</p>
          </div>
          <div class="content">
            <span class="notification-type type-${data.type}">${data.type}</span>
            <h2 style="color: #333; margin: 20px 0 10px 0;">${data.title}</h2>
            <p style="margin: 0 0 15px 0; color: #666;">Hello ${data.userName},</p>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
              <p style="margin: 0; line-height: 1.6;">${data.message}</p>
            </div>
            <a href="${window.location.origin}/notifications" class="button">View All Notifications</a>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #6c757d;">
              This is an automated notification from the Caava Group Devices Management System.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Caava Group. All rights reserved.</p>
            <p>If you have any questions, please contact your system administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
