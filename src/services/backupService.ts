import api from './apiService';
import { Asset, User, Department, Issue, AssetRequest } from '../lib/supabase';

export interface BackupData {
  id?: string;
  timestamp: string;
  version: string;
  name: string;
  description?: string;
  tables: {
    assets: Asset[];
    users: User[];
    departments: Department[];
    issues: Issue[];
    asset_requests: AssetRequest[];
    notifications: any[];
    user_notification_preferences: any[];
  };
  metadata: {
    totalAssets: number;
    totalUsers: number;
    totalIssues: number;
    backupSize: number;
  };
}

export interface StoredBackup {
  id: string;
  name: string;
  description?: string;
  timestamp: string;
  version: string;
  metadata: {
    totalAssets: number;
    totalUsers: number;
    totalIssues: number;
    backupSize: number;
  };
  created_by: string;
}

export interface BackupSchedule {
  id: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  retentionDays: number;
  lastBackup?: string;
  nextBackup?: string;
}

export class BackupService {
  private static instance: BackupService;
  private backupSchedules: BackupSchedule[] = [];

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Create a complete system backup and store it in the database
   */
  async createBackup(name: string, description?: string): Promise<StoredBackup> {
    // Use backend API
    const response = await api.post('/backups', { name, description });
    return response.data.backup as StoredBackup;
  }

  /**
   * Get all stored backups
   */
  async getStoredBackups(): Promise<StoredBackup[]> {
    const response = await api.get('/backups', { params: { limit: 1000 } });
    return response.data.backups as StoredBackup[];
  }

  /**
   * Get a specific backup by ID
   */
  async getBackupById(backupId: string): Promise<BackupData | null> {
    const response = await api.get(`/backups/${backupId}`);
    const backup = response.data.backup;
    return backup || null;
  }

  /**
   * Download backup as JSON file
   */
  async downloadBackup(backupId: string): Promise<void> {
    const response = await api.get(`/backups/${encodeURIComponent(backupId)}/download`, { responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match ? match[1] : `backup-${backupId}.json`;
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Delete a stored backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    await api.delete(`/backups/${backupId}`);
  }

  /**
   * Restore system from backup
   */
  async restoreBackup(backupId: string, options: {
    clearExisting?: boolean;
    skipUsers?: boolean;
    skipNotifications?: boolean;
  } = {}): Promise<void> {
    // Use backend endpoint to restore JSON by ID
    await api.post(`/backups/${encodeURIComponent(backupId)}/restore-json`, { clearExisting: options.clearExisting === true });
  }

  /**
   * Clear all data from the system
   */
  private async clearAllData(): Promise<void> {
    const tables = [
      'notifications',
      'user_notification_preferences',
      'issues',
      'asset_requests',
      'assets',
      'users',
      'departments'
    ];

    
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) {
          throw new Error(`Failed to clear table ${table}: ${error.message}`);
        }
        
      } catch (error) {
        throw error;
      }
    }
    
  }

  /**
   * Validate backup data structure
   */
  private validateBackupData(backupData: any): backupData is BackupData {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup data: not an object');
    }

    if (!backupData.timestamp || typeof backupData.timestamp !== 'string') {
      throw new Error('Invalid backup data: missing or invalid timestamp');
    }

    if (!backupData.tables || typeof backupData.tables !== 'object') {
      throw new Error('Invalid backup data: missing or invalid tables object');
    }

    const requiredTables = ['assets', 'users', 'departments', 'issues', 'asset_requests', 'notifications', 'user_notification_preferences'];
    for (const table of requiredTables) {
      if (!Array.isArray(backupData.tables[table])) {
        throw new Error(`Invalid backup data: missing or invalid table '${table}'`);
      }
    }

    return true;
  }

  /**
   * Upload and restore from backup file
   */
  async uploadAndRestore(file: File, options?: {
    clearExisting?: boolean;
    skipUsers?: boolean;
    skipNotifications?: boolean;
  }): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    await api.post('/backups/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  }

  // SQL backup endpoints
  async createSqlBackup(): Promise<{ file: string }> {
    const response = await api.post('/backups/sql', {});
    return response.data;
  }

  async listSqlFiles(): Promise<{ name: string; size: number; modified: string }[]> {
    const response = await api.get('/backups/files');
    return (response.data.files || []).map((f: any) => ({ ...f, modified: new Date(f.modified).toString() }));
  }

  async downloadSqlFile(name: string): Promise<void> {
    const response = await api.get(`/backups/files/${encodeURIComponent(name)}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async restoreFromServerFile(name: string): Promise<void> {
    await api.post('/backups/restore-file', { name });
  }

  async deleteSqlFile(name: string): Promise<void> {
    await api.delete(`/backups/files/${encodeURIComponent(name)}`);
  }

  /**
   * Schedule automatic backups
   */
  async scheduleBackup(schedule: Omit<BackupSchedule, 'id'>): Promise<BackupSchedule> {
    const newSchedule: BackupSchedule = {
      ...schedule,
      id: `schedule_${Date.now()}`,
      lastBackup: undefined,
      nextBackup: this.calculateNextBackup(schedule.frequency, schedule.time)
    };

    this.backupSchedules.push(newSchedule);
    
    // Store in localStorage for persistence
    localStorage.setItem('backupSchedules', JSON.stringify(this.backupSchedules));
    
    return newSchedule;
  }

  /**
   * Get all backup schedules
   */
  async getBackupSchedules(): Promise<BackupSchedule[]> {
    const stored = localStorage.getItem('backupSchedules');
    if (stored) {
      this.backupSchedules = JSON.parse(stored);
    }
    return this.backupSchedules;
  }

  /**
   * Delete a backup schedule
   */
  async deleteBackupSchedule(scheduleId: string): Promise<void> {
    this.backupSchedules = this.backupSchedules.filter(s => s.id !== scheduleId);
    localStorage.setItem('backupSchedules', JSON.stringify(this.backupSchedules));
  }

  /**
   * Calculate next backup time
   */
  private calculateNextBackup(frequency: string, time: string): string {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    let nextBackup = new Date();
    nextBackup.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case 'daily':
        nextBackup.setDate(nextBackup.getDate() + 1);
        break;
      case 'weekly':
        nextBackup.setDate(nextBackup.getDate() + 7);
        break;
      case 'monthly':
        nextBackup.setMonth(nextBackup.getMonth() + 1);
        break;
    }

    return nextBackup.toISOString();
  }

  /**
   * Check and execute scheduled backups
   */
  async checkScheduledBackups(): Promise<void> {
    const schedules = await this.getBackupSchedules();
    const now = new Date();

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      const nextBackup = new Date(schedule.nextBackup || '');
      if (now >= nextBackup) {
        try {
          const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
          await this.createBackup(
            `Scheduled Backup - ${schedule.frequency} - ${dateStr} ${timeStr}`,
            `Automatic backup from schedule ${schedule.id}`
          );
          
          // Update schedule
          schedule.lastBackup = now.toISOString();
          schedule.nextBackup = this.calculateNextBackup(schedule.frequency, schedule.time);
          
          localStorage.setItem('backupSchedules', JSON.stringify(this.backupSchedules));
          
        } catch (error) {
        }
      }
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    totalAssets: number;
    totalUsers: number;
    totalIssues: number;
    totalDepartments: number;
    lastBackup?: string;
  }> {
    try {
      const [
        { count: assetsCount },
        { count: usersCount },
        { count: issuesCount },
        { count: deptCount }
      ] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('issues').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true })
      ]);

      const schedules = await this.getBackupSchedules();
      const lastBackup = schedules
        .filter(s => s.lastBackup)
        .sort((a, b) => new Date(b.lastBackup!).getTime() - new Date(a.lastBackup!).getTime())[0]?.lastBackup;

      return {
        totalAssets: assetsCount || 0,
        totalUsers: usersCount || 0,
        totalIssues: issuesCount || 0,
        totalDepartments: deptCount || 0,
        lastBackup
      };
    } catch (error) {
      return {
        totalAssets: 0,
        totalUsers: 0,
        totalIssues: 0,
        totalDepartments: 0
      };
    }
  }
}

// Export singleton instance
export const backupService = BackupService.getInstance();
