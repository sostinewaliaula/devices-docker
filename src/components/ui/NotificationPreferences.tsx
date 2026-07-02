import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { notificationPreferencesService } from '../../services/notificationPreferencesService';
import { useNotifications } from '../../contexts/NotificationContext';
import { BellIcon, MailIcon, ClockIcon, CheckIcon } from 'lucide-react';

interface NotificationPreferences {
  email_notifications: boolean;
  in_app_notifications: boolean;
  notification_types: string[];
  email_frequency: 'immediate' | 'daily' | 'weekly';
}

const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const notificationTypeOptions = [
    { value: 'success', label: 'Success', color: 'text-green-600' },
    { value: 'error', label: 'Error', color: 'text-red-600' },
    { value: 'warning', label: 'Warning', color: 'text-yellow-600' },
    { value: 'info', label: 'Info', color: 'text-blue-600' }
  ];

  const frequencyOptions = [
    { value: 'immediate', label: 'Immediate', icon: MailIcon },
    { value: 'daily', label: 'Daily Digest', icon: ClockIcon },
    { value: 'weekly', label: 'Weekly Digest', icon: ClockIcon }
  ];

  useEffect(() => {
    if (user?.id) {
      loadPreferences();
    }
  }, [user?.id]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await notificationPreferencesService.getCurrentUserPreferences();
      setPreferences(data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load notification preferences',
        type: 'error',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!preferences || !user?.id) return;

    try {
      setSaving(true);
      const data = await notificationPreferencesService.updateCurrentUserPreferences({
        email_notifications: preferences.email_notifications,
        in_app_notifications: preferences.in_app_notifications
      });

      setPreferences(data);
      addToast({
        title: 'Success',
        message: 'Notification preferences updated successfully',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update notification preferences',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSaving(false);
    }
  };


  const toggleNotificationType = (type: string) => {
    if (!preferences) return;

    setPreferences(prev => {
      if (!prev) return prev;
      
      const newTypes = prev.notification_types.includes(type)
        ? prev.notification_types.filter(t => t !== type)
        : [...prev.notification_types, type];
      
      return { ...prev, notification_types: newTypes };
    });
  };

  const toggleEmailNotifications = () => {
    if (!preferences) return;
    setPreferences(prev => prev ? { ...prev, email_notifications: !prev.email_notifications } : prev);
  };

  const toggleInAppNotifications = () => {
    if (!preferences) return;
    setPreferences(prev => prev ? { ...prev, in_app_notifications: !prev.in_app_notifications } : prev);
  };

  const updateFrequency = (frequency: 'immediate' | 'daily' | 'weekly') => {
    if (!preferences) return;
    setPreferences(prev => prev ? { ...prev, email_frequency: frequency } : prev);
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading preferences...</span>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Failed to load notification preferences
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <div className="flex items-center mb-6">
        <BellIcon className="w-6 h-6 text-primary mr-3" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Notification Preferences
        </h2>
      </div>

      {/* Email Notifications Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Email Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Receive notifications via email
            </p>
          </div>
          <button
            onClick={toggleEmailNotifications}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.email_notifications ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.email_notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* In-App Notifications Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              In-App Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Show notifications within the application
            </p>
          </div>
          <button
            onClick={toggleInAppNotifications}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.in_app_notifications ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.in_app_notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notification Types */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Notification Types
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose which types of notifications you want to receive via email
        </p>
        <div className="grid grid-cols-2 gap-3">
          {notificationTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleNotificationType(option.value)}
              className={`flex items-center p-3 rounded-lg border-2 transition-all ${
                preferences.notification_types.includes(option.value)
                  ? 'border-primary bg-primary bg-opacity-10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
              }`}
            >
              <div className={`w-4 h-4 rounded-full mr-3 ${
                preferences.notification_types.includes(option.value)
                  ? 'bg-primary'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                {preferences.notification_types.includes(option.value) && (
                  <CheckIcon className="w-4 h-4 text-white" />
                )}
              </div>
              <span className={`font-medium ${
                preferences.notification_types.includes(option.value)
                  ? 'text-primary'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Email Frequency */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Email Frequency
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choose how often you want to receive email notifications
        </p>
        <div className="grid grid-cols-3 gap-3">
          {frequencyOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => updateFrequency(option.value)}
                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  preferences.email_frequency === option.value
                    ? 'border-primary bg-primary bg-opacity-10'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <Icon className={`w-6 h-6 mb-2 ${
                  preferences.email_frequency === option.value
                    ? 'text-primary'
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  preferences.email_frequency === option.value
                    ? 'text-primary'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="button-primary px-6 py-2 flex items-center"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4 mr-2" />
              Save Preferences
            </>
          )}
        </button>
      </div>


      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              How it works
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <ul className="list-disc list-inside space-y-1">
                <li>In-app notifications are always shown regardless of email settings</li>
                <li>Email notifications are sent based on your preferences</li>
                <li>Daily/Weekly digests combine multiple notifications into one email</li>
                <li>You can change these settings at any time</li>
                {/* <li>Use the "Test Email System" button to verify everything is working</li> */}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferences;
