import { supabase } from '../lib/supabase';
import { emailNotificationService, EmailNotificationData } from './emailNotificationService';
import { Asset, Department, User, Issue, IssueComment, AssetMaintenance, NotificationRecord, AuditLog } from '../lib/supabase';

// Department operations
export const departmentService = {
  async getAll(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(department: Omit<Department, 'id' | 'created_at' | 'updated_at'>): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .insert([department])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Audit operations
export const auditService = {
  async write(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{ action: log.action, entity_type: log.entity_type, entity_id: log.entity_id, user_id: log.user_id, details: log.details ?? {}, created_at: new Date().toISOString() }]);
    if (error) throw error;
  },
  async list(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, user_id, action, entity_type, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as AuditLog[]) || [];
  }
}

// Backup email recipients operations
export const backupEmailRecipientsService = {
  async getAll(): Promise<any[]> {
    const { data, error } = await supabase
      .from('backup_email_recipients')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching backup email recipients:', error);
      throw error;
    }
    return data || []
  },

  async getById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('backup_email_recipients')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(recipient: { email: string; name?: string; role?: string }): Promise<any> {
    const { data, error } = await supabase
      .from('backup_email_recipients')
      .insert([recipient])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating backup email recipient:', error);
      throw error;
    }
    return data
  },

  async update(id: string, updates: Partial<any>): Promise<any> {
    const { data, error } = await supabase
      .from('backup_email_recipients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('backup_email_recipients')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  },

  async getActiveEmails(): Promise<string[]> {
    const { data, error } = await supabase
      .from('backup_email_recipients')
      .select('email')
      .eq('is_active', true)
    
    if (error) throw error
    return (data || []).map(r => r.email)
  }
}

// Add notification service
export const notificationService = {
  async getForUser(userId: string, limit = 100): Promise<NotificationRecord[]> {
    const { data, error } = await supabase.rpc('get_notifications_for_user', { target_user: userId });
    if (error) throw error;
    return (data || []).slice(0, limit);
  },
  
  async markAsRead(id: string): Promise<NotificationRecord> {
    const { data, error } = await supabase.rpc('mark_notification_read', { target_id: id });
    if (error) throw error;
    return data as NotificationRecord;
  },
  
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_all_notifications_read', { target_user: userId });
    if (error) throw error;
  },
  
  async create(rec: Omit<NotificationRecord, 'id' | 'created_at'>): Promise<NotificationRecord> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([rec])
      .select()
      .single()
    if (error) throw error
    
    // Send email notification after creating the database record
    await this.sendEmailNotification(data);
    
    return data
  },
  
  async notifyUser(userId: string, title: string, message: string, type: NotificationRecord['type']): Promise<void> {
    const { error } = await supabase.rpc('create_notification', {
      target_user: userId,
      title_param: title,
      message_param: message,
      type_param: type
    })
    if (error) throw error
    
    // Send email notification after creating the database record
    await this.sendEmailNotificationForUser(userId, title, message, type);
  },

  /**
   * Send email notification for a newly created notification
   */
  async sendEmailNotification(notification: NotificationRecord): Promise<void> {
    try {
      // Get user details to send email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', notification.user_id)
        .single();

      if (userError || !user) {
        return;
      }

      // Check if email notifications are enabled
      const isEmailEnabled = await emailNotificationService.isEmailEnabled();
      if (!isEmailEnabled) {
        return;
      }

      // Get user email preferences
      const preferences = await emailNotificationService.getUserEmailPreferences(notification.user_id);
      if (!preferences.emailNotifications || !preferences.notificationTypes.includes(notification.type)) {
        return;
      }

      // Prepare email data
      const emailData: EmailNotificationData = {
        userId: notification.user_id,
        userEmail: user.email,
        userName: user.name,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        notificationId: notification.id
      };

      // Send email notification
      await emailNotificationService.sendNotificationEmail(emailData);
      
    } catch (error) {
      // Don't throw error - email failure shouldn't break the notification system
    }
  },

  /**
   * Send email notification for a user (when using notifyUser function)
   */
  async sendEmailNotificationForUser(userId: string, title: string, message: string, type: NotificationRecord['type']): Promise<void> {
    try {
      // Get user details to send email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return;
      }

      // Check if email notifications are enabled
      const isEmailEnabled = await emailNotificationService.isEmailEnabled();
      if (!isEmailEnabled) {
        return;
      }

      // Get user email preferences
      const preferences = await emailNotificationService.getUserEmailPreferences(userId);
      if (!preferences.emailNotifications || !preferences.notificationTypes.includes(type)) {
        return;
      }

      // Create a temporary notification ID for email tracking
      const tempNotificationId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Prepare email data
      const emailData: EmailNotificationData = {
        userId: userId,
        userEmail: user.email,
        userName: user.name,
        title: title,
        message: message,
        type: type,
        notificationId: tempNotificationId
      };

      // Send email notification
      await emailNotificationService.sendNotificationEmail(emailData);
      
    } catch (error) {
      // Don't throw error - email failure shouldn't break the notification system
    }
  },

  /**
   * Send bulk notifications to multiple users with emails
   */
  async notifyMultipleUsers(userIds: string[], title: string, message: string, type: NotificationRecord['type']): Promise<void> {
    try {
      // Create notifications for all users
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        read: false
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      // Send email notifications for all users
      if (data && data.length > 0) {
        const emailNotifications: EmailNotificationData[] = [];

        for (const notification of data) {
          // Get user details
          const { data: user } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', notification.user_id)
            .single();

          if (user) {
            emailNotifications.push({
              userId: notification.user_id,
              userEmail: user.email,
              userName: user.name,
              title: notification.title,
              message: notification.message,
              type: notification.type,
              notificationId: notification.id
            });
          }
        }

        // Send bulk emails
        if (emailNotifications.length > 0) {
          await emailNotificationService.sendBulkNotifications(emailNotifications);
        }
      }
    } catch (error) {
      throw error;
    }
  }
};

// Asset operations
export const assetService = {
  async getAll(): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Asset | null> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async getByDepartment(departmentId: string): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByAssignedUser(userId: string, limit = 50): Promise<Asset[]> {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  async create(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
    // Automatically set status based on assignment
    const processedAsset = { ...asset };
    
    // If assigned_to is set, set status to 'Assigned', otherwise 'Available'
    if (asset.assigned_to) {
      processedAsset.status = 'Assigned';
    } else {
      processedAsset.status = 'Available';
    }
    
    const { data, error } = await supabase
      .from('assets')
      .insert([processedAsset])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Asset>): Promise<Asset> {
    // Automatically set status based on assignment
    const processedUpdates = { ...updates };
    
    // If assigned_to is being set, set status to 'Assigned'
    if (updates.assigned_to !== undefined) {
      if (updates.assigned_to) {
        processedUpdates.status = 'Assigned';
      } else {
        // If assigned_to is being cleared, set status to 'Available'
        processedUpdates.status = 'Available';
      }
    }
    
    const { data, error } = await supabase
      .from('assets')
      .update({ ...processedUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// User operations
export const userService = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async getByDepartment(departmentId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByRoles(roles: string[]): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', roles)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single()
    
    if (error) throw error
    try { await auditService.write({ user_id: null, action: 'user.create', entity_type: 'user', entity_id: (data as any).id, details: { after: data } }); } catch {}
    return data
  },

  async update(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    try { await auditService.write({ user_id: null, action: 'user.update', entity_type: 'user', entity_id: id, details: { updates } }); } catch {}
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    try { await auditService.write({ user_id: null, action: 'user.delete', entity_type: 'user', entity_id: id, details: {} }); } catch {}
  }
}

// Issue operations
export const issueService = {
  async getAll(): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Issue | null> {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async getByAsset(assetId: string): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByReporter(userId: string, limit = 50): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('reported_by', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  async create(issue: Omit<Issue, 'id' | 'created_at' | 'updated_at'>): Promise<Issue> {
    const { data, error } = await supabase
      .from('issues')
      .insert([issue])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Issue>): Promise<Issue> {
    const { data, error } = await supabase
      .from('issues')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

// Comment operations
export const commentService = {
  async getByIssue(issueId: string): Promise<IssueComment[]> {
    const { data, error } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  async create(comment: Omit<IssueComment, 'id' | 'created_at' | 'updated_at'>): Promise<IssueComment> {
    
    // Get the user name from the users table
    let userName = 'Unknown User';
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', comment.user_id)
        .single();
      
      if (userData?.name) {
        userName = userData.name;
      }
    } catch (error) {
    }
    
    const commentData = {
      ...comment,
      user_name: userName
    };
    
    
    const { data, error } = await supabase
      .from('issue_comments')
      .insert([commentData])
      .select()
      .single()
    
    if (error) {
      throw error;
    }
    
    try { await auditService.write({ user_id: (data as any).user_id || null, action: 'comment.create', entity_type: 'issue_comment', entity_id: (data as any).id, details: { after: data } }); } catch {}
    return data
  },

  async update(id: string, updates: Partial<IssueComment>): Promise<IssueComment> {
    
    const { data, error } = await supabase
      .from('issue_comments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      throw error;
    }
    
    try { await auditService.write({ user_id: (data as any).user_id || null, action: 'comment.update', entity_type: 'issue_comment', entity_id: id, details: { updates } }); } catch {}
    return data
  },

  async delete(id: string): Promise<void> {
    
    const { error } = await supabase
      .from('issue_comments')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error;
    }
    
  },

  // Test function to check table structure
  async testTableStructure(): Promise<void> {
    try {
      const { error } = await supabase
        .from('issue_comments')
        .select('*')
        .limit(1)
      
      if (error) {
      } else {
      }
    } catch (error) {
    }
  }
}

// Asset Maintenance operations
export const assetMaintenanceService = {
  async getAll(): Promise<AssetMaintenance[]> {
    const { data, error } = await supabase
      .from('asset_maintenance')
      .select('*')
      .order('performed_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async getByAsset(assetId: string): Promise<AssetMaintenance[]> {
    const { data, error } = await supabase
      .from('asset_maintenance')
      .select('*')
      .eq('asset_id', assetId)
      .order('performed_date', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  async create(maintenance: Omit<AssetMaintenance, 'id' | 'created_at'>): Promise<AssetMaintenance> {
    const { data, error } = await supabase
      .from('asset_maintenance')
      .insert([maintenance])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<AssetMaintenance>): Promise<AssetMaintenance> {
    const { data, error } = await supabase
      .from('asset_maintenance')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('asset_maintenance')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    try { await auditService.write({ user_id: null, action: 'comment.delete', entity_type: 'issue_comment', entity_id: id, details: {} }); } catch {}
  }
}

export const assetRequestsService = {
  async create(req: { user_id: string; title: string; description: string; type: string; priority: string; department_id: string | null; }): Promise<any> {
    // Use SECURITY DEFINER RPC to bypass RLS safely
    const { data, error } = await supabase.rpc('create_asset_request', {
      p_user_id: req.user_id,
      p_title: req.title,
      p_description: req.description,
      p_type: req.type,
      p_priority: req.priority,
      p_department_id: req.department_id
    });
    if (error) throw error;
    return data;
  },
  async getByUser(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('asset_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}
