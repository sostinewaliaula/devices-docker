import api from './apiService';

export interface NotificationPreferences {
  email_notifications: boolean;
  in_app_notifications: boolean;
  notification_types?: string[];
  email_frequency?: 'immediate' | 'daily' | 'weekly';
}

export const notificationPreferencesService = {
  // Get user notification preferences
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const response = await api.get(`/notification-preferences/users/${userId}/preferences`);
    return response.data;
  },

  // Update user notification preferences
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await api.put(`/notification-preferences/users/${userId}/preferences`, preferences);
    return response.data;
  },

  // Get current user's notification preferences
  async getCurrentUserPreferences(): Promise<NotificationPreferences> {
    const response = await api.get('/notification-preferences/me');
    return response.data;
  },

  // Update current user's notification preferences
  async updateCurrentUserPreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await api.put('/notification-preferences/me', preferences);
    return response.data;
  }
};
