import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import api from '../../services/apiService';
import { 
  BellIcon, 
  ClockIcon, 
  CalendarIcon, 
  CheckCircleIcon,
  XCircleIcon,
  SaveIcon,
  PlayIcon,
  AlertCircleIcon,
  CheckIcon
} from 'lucide-react';

interface WeeklyNotificationSchedule {
  enabled: boolean;
  days: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  time: string; // HH:MM format
  timezone: string;
}

const WeeklyNotifications: React.FC = () => {
  const { user } = useAuth();
  const { addNotification, addToast } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [schedule, setSchedule] = useState<WeeklyNotificationSchedule>({
    enabled: true,
    days: [1], // Monday by default
    time: '09:00',
    timezone: 'Africa/Nairobi'
  });

  const daysOfWeek = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' }
  ];

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await api.get('/weekly-notifications/schedule');
      if (response.data) {
        setSchedule(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load notification schedule',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/weekly-notifications/schedule', schedule);
      addNotification({
        title: 'Success',
        message: 'Weekly notification schedule has been updated successfully',
        type: 'success'
      });
      addToast({
        title: 'Schedule Updated',
        message: 'Your weekly notification schedule has been saved',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      addNotification({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update schedule',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Failed to save schedule. Please try again.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const response = await api.post('/weekly-notifications/trigger');
      if (response.data.success) {
        addNotification({
          title: 'Test Successful',
          message: `Weekly summary sent successfully! ${response.data.stats.adminsNotified} admin(s) notified.`,
          type: 'success'
        });
        addToast({
          title: 'Test Notification Sent',
          message: `Found ${response.data.stats.unresolvedIssues} unresolved issues and ${response.data.stats.pendingRequests} pending asset requests`,
          type: 'success',
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error('Error testing notification:', error);
      addNotification({
        title: 'Test Failed',
        message: error.response?.data?.message || 'Failed to send test notification',
        type: 'error'
      });
    } finally {
      setTesting(false);
    }
  };

  const toggleDay = (dayValue: number) => {
    setSchedule(prev => {
      const newDays = prev.days.includes(dayValue)
        ? prev.days.filter(d => d !== dayValue)
        : [...prev.days, dayValue].sort();
      return { ...prev, days: newDays };
    });
  };

  const selectAllDays = () => {
    setSchedule(prev => ({
      ...prev,
      days: daysOfWeek.map(d => d.value)
    }));
  };

  const clearAllDays = () => {
    setSchedule(prev => ({
      ...prev,
      days: []
    }));
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">Access Denied</h2>
          <p className="text-gray-500">You need admin privileges to manage weekly notifications.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card md:flex-row md:items-center">
        <div className="flex items-center">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <BellIcon className="w-12 h-12 text-primary" />
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-primary">Weekly Notification Schedule</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure when admins receive weekly summaries of unresolved issues and pending asset requests
            </p>
          </div>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0">
          <button
            onClick={handleTest}
            disabled={testing || !schedule.enabled}
            className="button-secondary flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayIcon className="w-4 h-4 mr-2" />
            {testing ? 'Sending...' : 'Test Now'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Enable Notifications</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Turn weekly notifications on or off
                </p>
              </div>
              <button
                onClick={() => setSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  schedule.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    schedule.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Days Selection */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
                  Select Days
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose which days of the week to send notifications
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllDays}
                  className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllDays}
                  className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map(day => {
                const isSelected = schedule.days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    disabled={!schedule.enabled}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-lg scale-105'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    } ${!schedule.enabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                  >
                    <div className="text-center">
                      <div className="text-xs font-medium mb-1">{day.short}</div>
                      <div className="text-lg font-bold">{day.label.substring(0, 3)}</div>
                      {isSelected && (
                        <CheckIcon className="w-5 h-5 mx-auto mt-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {schedule.days.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center">
                <AlertCircleIcon className="w-4 h-4 mr-1" />
                Please select at least one day
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center mb-4">
              <ClockIcon className="w-5 h-5 mr-2 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Time</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Set the time when notifications should be sent (24-hour format)
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule(prev => ({ ...prev, time: e.target.value }))}
                  disabled={!schedule.enabled}
                  className="px-4 py-3 text-lg font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select
                  value={schedule.timezone}
                  onChange={(e) => setSchedule(prev => ({ ...prev, timezone: e.target.value }))}
                  disabled={!schedule.enabled}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (Eastern Time)</option>
                  <option value="America/Chicago">America/Chicago (Central Time)</option>
                  <option value="America/Denver">America/Denver (Mountain Time)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time)</option>
                  <option value="America/Phoenix">America/Phoenix (Mountain Time - No DST)</option>
                  <option value="America/Anchorage">America/Anchorage (Alaska Time)</option>
                  <option value="Pacific/Honolulu">Pacific/Honolulu (Hawaii Time)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                  <option value="Europe/Rome">Europe/Rome (CET/CEST)</option>
                  <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                  <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                  <option value="Europe/Athens">Europe/Athens (EET/EEST)</option>
                  <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                  <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
                  <option value="Australia/Melbourne">Australia/Melbourne (AEDT/AEST)</option>
                  <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                  <option value="Australia/Perth">Australia/Perth (AWST)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</option>
                  <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT) - Default</option>
                  <option value="America/Mexico_City">America/Mexico_City (CST/CDT)</option>
                  <option value="America/Sao_Paulo">America/Sao_Paulo (BRT/BRST)</option>
                  <option value="America/Buenos_Aires">America/Buenos_Aires (ART)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Notifications will be sent at the selected time in this timezone
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !schedule.enabled || schedule.days.length === 0}
              className="button-primary flex items-center px-6 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SaveIcon className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Notifications</span>
                {schedule.enabled ? (
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                    Enabled
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <XCircleIcon className="w-4 h-4 mr-1" />
                    Disabled
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Days Selected</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {schedule.days.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Time</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {schedule.time}
                </span>
              </div>
            </div>
          </div>

          {/* Information Card */}
          <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl border border-primary/20">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About Weekly Notifications</h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p>
                Weekly notifications are automatically sent to all active admin users with email notifications enabled.
              </p>
              <p>
                <strong>What's included:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Unresolved issues (open, in progress, scheduled)</li>
                <li>Pending asset requests (awaiting approval)</li>
              </ul>
              <p className="mt-3">
                <strong>Note:</strong> The schedule will take effect after saving. Changes require a server restart to fully apply.
              </p>
            </div>
          </div>

          {/* Selected Days Preview */}
          {schedule.days.length > 0 && (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Selected Days</h3>
              <div className="flex flex-wrap gap-2">
                {schedule.days.map(dayValue => {
                  const day = daysOfWeek.find(d => d.value === dayValue);
                  return (
                    <span
                      key={dayValue}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium"
                    >
                      {day?.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyNotifications;

