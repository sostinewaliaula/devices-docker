import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  DownloadIcon,
  UploadIcon,
  PlusIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  MailIcon,
  EditIcon,
  XIcon,
  CheckIcon,
  UsersIcon,
  TrashIcon,
  ClockIcon,
  CalendarIcon,
  DatabaseIcon,
  PlayIcon,
  SaveIcon
} from 'lucide-react';
import { backupService } from '../../services/backupService';
import api from '../../services/apiService';


const BackupManagement: React.FC = () => {
  const { user } = useAuth();
  const { addNotification, addToast } = useNotifications();

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showCreateBackupModal, setShowCreateBackupModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sqlFiles, setSqlFiles] = useState<{ name: string; size: number; modified: string }[]>([]);
  const [busySql, setBusySql] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState<{
    enabled: boolean;
    days: number[];
    time: string;
    timezone: string;
  }>({
    enabled: true,
    days: [1],
    time: '02:00',
    timezone: 'Africa/Nairobi'
  });
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [testingBackup, setTestingBackup] = useState(false);
  const [downloadedBackups, setDownloadedBackups] = useState<Array<{
    name: string;
    date: string;
    type: 'json' | 'sql' | 'sql.gz';
    size: number;
    data?: Blob;
  }>>([]);
  const [restoreSource, setRestoreSource] = useState<'upload' | 'downloaded'>('upload');
  const [selectedDownloadedBackup, setSelectedDownloadedBackup] = useState<string | null>(null);
  const [newBackup, setNewBackup] = useState({
    name: '',
    description: ''
  });

  // Backup email recipients state
  interface BackupEmailRecipient {
    id: string;
    email: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
  }
  const [recipients, setRecipients] = useState<BackupEmailRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<BackupEmailRecipient | null>(null);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [isSubmittingRecipient, setIsSubmittingRecipient] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<BackupEmailRecipient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadSqlFiles();
    loadRecipients();
    loadDownloadedBackups();
    loadBackupSchedule();
  }, []);

  const daysOfWeek = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' }
  ];

  const loadBackupSchedule = async () => {
    try {
      setScheduleLoading(true);
      const response = await api.get('/backup/schedule');
      if (response.data) {
        setBackupSchedule(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching backup schedule:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load backup schedule',
        type: 'error'
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSaveBackupSchedule = async () => {
    if (backupSchedule.days.length === 0) {
      addToast({
        title: 'Validation Error',
        message: 'Please select at least one day for backups',
        type: 'error'
      });
      return;
    }

    try {
      setScheduleSaving(true);
      const response = await api.put('/backup/schedule', backupSchedule);
      if (response.data.success) {
        addToast({
          title: 'Success',
          message: 'Backup schedule has been updated successfully',
          type: 'success'
        });
        // Trigger reload of cron jobs
        try {
          await api.post('/backup/reload');
        } catch (e) {
          // console.log('Note: Cron reload endpoint may not be available');
        }
      }
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save backup schedule',
        type: 'error'
      });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTestBackup = async () => {
    try {
      setTestingBackup(true);
      const response = await api.post('/backup/trigger');
      if (response.data.success) {
        addToast({
          title: 'Success',
          message: 'Test backup created and sent successfully',
          type: 'success'
        });
        await loadSqlFiles(); // Reload file list
      }
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create test backup',
        type: 'error'
      });
    } finally {
      setTestingBackup(false);
    }
  };

  const toggleBackupDay = (dayValue: number) => {
    setBackupSchedule(prev => {
      const newDays = prev.days.includes(dayValue)
        ? prev.days.filter(d => d !== dayValue)
        : [...prev.days, dayValue].sort();
      return { ...prev, days: newDays };
    });
  };

  const selectAllBackupDays = () => {
    setBackupSchedule(prev => ({
      ...prev,
      days: daysOfWeek.map(d => d.value)
    }));
  };

  const clearAllBackupDays = () => {
    setBackupSchedule(prev => ({
      ...prev,
      days: []
    }));
  };

  // Load previously downloaded backups from localStorage
  const loadDownloadedBackups = () => {
    try {
      const stored = localStorage.getItem('downloadedBackups');
      if (stored) {
        const backups = JSON.parse(stored);
        setDownloadedBackups(backups);
      }
    } catch (error) {
      console.error('Error loading downloaded backups:', error);
    }
  };

  // Save downloaded backup metadata to localStorage
  const saveDownloadedBackup = (name: string, type: 'json' | 'sql' | 'sql.gz', size: number, data?: Blob) => {
    try {
      const backup = {
        name,
        date: new Date().toISOString(),
        type,
        size,
      };
      const existing = JSON.parse(localStorage.getItem('downloadedBackups') || '[]');
      // Remove duplicate if exists
      const filtered = existing.filter((b: any) => b.name !== name);
      const updated = [backup, ...filtered].slice(0, 20); // Keep last 20
      localStorage.setItem('downloadedBackups', JSON.stringify(updated));
      setDownloadedBackups(updated);
    } catch (error) {
      console.error('Error saving downloaded backup:', error);
    }
  };

  // Generate default backup name based on current date and time
  const generateDefaultBackupName = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `Backup - ${dateStr} ${timeStr}`;
  };

  const handleOpenCreateBackupModal = () => {
    setNewBackup({
      name: generateDefaultBackupName(),
      description: ''
    });
    setShowCreateBackupModal(true);
  };



  const loadSqlFiles = async () => {
    try {
      const files = await backupService.listSqlFiles();
      setSqlFiles(files);
    } catch { }
  };

  const handleCreateBackup = async () => {
    if (!newBackup.name.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please enter a backup name.',
        type: 'error'
      });
      return;
    }

    setIsCreatingBackup(true);
    try {
      await backupService.createBackup(newBackup.name, newBackup.description);

      addNotification({
        title: 'Backup Created',
        message: `System backup "${newBackup.name}" created and stored successfully.`,
        type: 'success'
      });

      addToast({
        title: 'Backup Created',
        message: 'System backup created and stored successfully.',
        type: 'success'
      });

      setShowCreateBackupModal(false);
      setNewBackup({ name: '', description: '' });
    } catch (error) {
      addNotification({
        title: 'Backup Failed',
        message: 'Failed to create system backup. Please try again.',
        type: 'error'
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.sql') || file.name.endsWith('.sql.gz'))) {
      setSelectedFile(file);
    } else {
      addToast({
        title: 'Invalid File',
        message: 'Please select a valid JSON/SQL backup file (.json, .sql, .sql.gz).',
        type: 'error'
      });
    }
  };

  const handleRestoreFromDownloaded = async () => {
    if (!selectedDownloadedBackup) return;

    const backup = downloadedBackups.find(b => b.name === selectedDownloadedBackup);
    if (!backup) return;

    setIsRestoring(true);
    try {
      // Re-download the file to get the blob
      const response = await api.get(`/backups/files/${encodeURIComponent(backup.name)}`, { responseType: 'blob' });

      // Convert blob to File
      const file = new File([response.data], backup.name, { type: response.data.type || 'application/octet-stream' });

      // Send to restore endpoint
      const form = new FormData();
      form.append('file', file);

      await api.post('/backups/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      addNotification({
        title: 'Restore Completed',
        message: 'System has been restored from backup successfully.',
        type: 'success'
      });

      addToast({
        title: 'Restore Completed',
        message: 'System restore completed successfully.',
        type: 'success'
      });

      setShowRestoreModal(false);
      setSelectedDownloadedBackup(null);
      setRestoreSource('upload');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error occurred';

      addNotification({
        title: 'Restore Failed',
        message: `Failed to restore system from backup: ${errorMessage}`,
        type: 'error'
      });

      addToast({
        title: 'Restore Failed',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUploadAndRestore = async () => {
    if (!selectedFile) return;

    setIsRestoring(true);
    try {
      // Send to restore endpoint
      const form = new FormData();
      form.append('file', selectedFile);

      await api.post('/backups/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      addNotification({
        title: 'Restore Completed',
        message: 'System has been restored from uploaded backup successfully.',
        type: 'success'
      });

      addToast({
        title: 'Restore Completed',
        message: 'System restore completed successfully.',
        type: 'success'
      });

      setShowRestoreModal(false);
      setSelectedFile(null);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error occurred';

      addNotification({
        title: 'Restore Failed',
        message: `Failed to restore system from backup: ${errorMessage}`,
        type: 'error'
      });

      addToast({
        title: 'Restore Failed',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCreateSqlBackup = async () => {
    setBusySql(true);
    try {
      await backupService.createSqlBackup();
      addToast({ title: 'SQL Backup Created', message: 'Zipped .sql backup generated and emailed to recipients.', type: 'success' });
      await loadSqlFiles();
    } catch (e: any) {
      addToast({ title: 'SQL Backup Failed', message: e?.message || 'Could not create SQL backup.', type: 'error' });
    } finally {
      setBusySql(false);
    }
  };

  const handleDownloadSql = async (name: string) => {
    try {
      const response = await api.get(`/backups/files/${encodeURIComponent(name)}`, { responseType: 'blob' });
      const size = response.data.size;
      const type = name.endsWith('.sql.gz') ? 'sql.gz' : name.endsWith('.sql') ? 'sql' : 'json';

      // Save metadata
      saveDownloadedBackup(name, type, size);

      // Trigger download
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to download backup file',
        type: 'error'
      });
    }
  };

  const handleRestoreSql = async (name: string) => {
    setIsRestoring(true);
    try {
      await backupService.restoreFromServerFile(name);
      addToast({ title: 'Restore Started', message: 'Database restored from selected SQL file.', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Restore Failed', message: e?.message || 'Failed to restore from SQL file.', type: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteSql = async (name: string) => {
    setIsDeletingFile(true);
    try {
      await backupService.deleteSqlFile(name);
      addToast({
        title: 'Success',
        message: 'Backup file deleted successfully',
        type: 'success'
      });
      setFileToDelete(null);
      await loadSqlFiles(); // Reload the list
    } catch (e: any) {
      addToast({
        title: 'Error',
        message: e?.response?.data?.error || e?.message || 'Failed to delete backup file',
        type: 'error'
      });
    } finally {
      setIsDeletingFile(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Backup email recipients functions
  const loadRecipients = async () => {
    try {
      setRecipientsLoading(true);
      const response = await api.get('/backup-email-recipients');
      if (response.data.success) {
        // Ensure is_active is converted to boolean (MySQL returns 0/1)
        const recipients = (response.data.data || []).map((r: any) => ({
          ...r,
          is_active: r.is_active === true || r.is_active === 1
        }));
        setRecipients(recipients);
      }
    } catch (error) {
      console.error('Error loading recipients:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load backup email recipients',
        type: 'error'
      });
    } finally {
      setRecipientsLoading(false);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientEmail.trim()) return;

    setIsSubmittingRecipient(true);
    try {
      const response = await api.post('/backup-email-recipients', {
        email: newRecipientEmail.trim()
      });
      if (response.data.success) {
        addToast({
          title: 'Success',
          message: 'Backup email recipient added successfully',
          type: 'success'
        });
        setNewRecipientEmail('');
        setShowRecipientModal(false);
        loadRecipients();
      }
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to add recipient',
        type: 'error'
      });
    } finally {
      setIsSubmittingRecipient(false);
    }
  };

  const handleUpdateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipient) return;

    setIsSubmittingRecipient(true);
    try {
      const response = await api.put(`/backup-email-recipients/${editingRecipient.id}`, {
        email: editingRecipient.email.trim()
      });
      if (response.data.success) {
        addToast({
          title: 'Success',
          message: 'Recipient updated successfully',
          type: 'success'
        });
        setEditingRecipient(null);
        loadRecipients();
      }
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update recipient',
        type: 'error'
      });
    } finally {
      setIsSubmittingRecipient(false);
    }
  };

  const handleDeleteRecipient = (recipient: BackupEmailRecipient) => {
    setRecipientToDelete(recipient);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRecipient = async () => {
    if (!recipientToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.delete(`/backup-email-recipients/${recipientToDelete.id}`);
      if (response.data.success) {
        addToast({
          title: 'Success',
          message: 'Recipient deleted successfully',
          type: 'success'
        });
        setShowDeleteConfirm(false);
        setRecipientToDelete(null);
        loadRecipients();
      }
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to delete recipient',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (recipient: BackupEmailRecipient) => {
    // Handle undefined/null as active (true), otherwise toggle
    const currentActive = recipient.is_active !== false;
    const newActiveStatus = !currentActive;
    const originalStatus = recipient.is_active;
    const recipientId = recipient.id;

    // Optimistic update: update UI immediately
    setRecipients(prevRecipients =>
      prevRecipients.map(r =>
        r.id === recipientId
          ? { ...r, is_active: newActiveStatus }
          : r
      )
    );

    try {
      const response = await api.put(`/backup-email-recipients/${recipientId}`, {
        email: recipient.email,
        is_active: newActiveStatus
      });

      if (response.data.success) {
        // Server confirmed - update with server response but force is_active to our new value
        const serverData = response.data.data;
        if (serverData) {
          // Convert server's is_active (might be 0/1) to boolean, but use our newActiveStatus
          const serverActiveBool = serverData.is_active === true || serverData.is_active === 1;

          // Always use newActiveStatus (what we sent) to ensure UI consistency
          setRecipients(prevRecipients =>
            prevRecipients.map(r =>
              r.id === recipientId
                ? {
                  ...serverData,
                  is_active: newActiveStatus // Force our intended value
                }
                : r
            )
          );
        }

        addToast({
          title: 'Success',
          message: `Recipient ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
          type: 'success'
        });
      } else {
        // Revert optimistic update on failure
        setRecipients(prevRecipients =>
          prevRecipients.map(r =>
            r.id === recipientId
              ? { ...r, is_active: originalStatus }
              : r
          )
        );
        addToast({
          title: 'Error',
          message: 'Failed to update recipient status',
          type: 'error'
        });
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setRecipients(prevRecipients =>
        prevRecipients.map(r =>
          r.id === recipientId
            ? { ...r, is_active: originalStatus }
            : r
        )
      );
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update recipient status',
        type: 'error'
      });
    }
  };


  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can access backup management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Backup Management</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Create, store, and manage system backups.
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCreateSqlBackup}
              disabled={busySql}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-purple-500 rounded-full shadow-button hover:opacity-90 flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              {busySql ? 'Creating SQL...' : 'Create SQL Backup'}
            </button>
            <button
              onClick={() => setShowRestoreModal(true)}
              className="px-4 py-2 text-sm font-medium text-secondary bg-lightblue rounded-full shadow-button hover:opacity-90"
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              Restore
            </button>
          </div>
        </div>
      </div>

      {/* Backup Schedule */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col justify-between mb-6 md:flex-row md:items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="p-3 bg-primary/10 rounded-2xl mr-4">
              <DatabaseIcon className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-primary">Automatic Backup Schedule</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure when automatic SQL backups should be created and emailed
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleTestBackup}
              disabled={testingBackup || !backupSchedule.enabled}
              className="px-4 py-2 text-sm font-medium text-secondary bg-lightblue rounded-full shadow-button hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <PlayIcon className="w-4 h-4 mr-2" />
              {testingBackup ? 'Creating...' : 'Test Backup'}
            </button>
          </div>
        </div>

        {scheduleLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-gray-600 dark:text-gray-300">Loading backup schedule...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enable Automatic Backups</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Turn automatic backups on or off
                  </p>
                </div>
                <button
                  onClick={() => setBackupSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${backupSchedule.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${backupSchedule.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* Days Selection */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
                    Select Days
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Choose which days of the week to create backups
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAllBackupDays}
                    className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllBackupDays}
                    className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {daysOfWeek.map(day => {
                  const isSelected = backupSchedule.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleBackupDay(day.value)}
                      disabled={!backupSchedule.enabled}
                      className={`p-4 rounded-xl border-2 transition-all ${isSelected
                          ? 'bg-primary text-white border-primary shadow-lg scale-105'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50'
                        } ${!backupSchedule.enabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
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
              {backupSchedule.days.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center">
                  <AlertTriangleIcon className="w-4 h-4 mr-1" />
                  Please select at least one day
                </p>
              )}
            </div>

            {/* Time Selection */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <div className="flex items-center mb-4">
                <ClockIcon className="w-5 h-5 mr-2 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Backup Time</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Set the time when backups should be created (24-hour format)
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <input
                    type="time"
                    value={backupSchedule.time}
                    onChange={(e) => setBackupSchedule(prev => ({ ...prev, time: e.target.value }))}
                    disabled={!backupSchedule.enabled}
                    className="px-4 py-3 text-lg font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone
                  </label>
                  <select
                    value={backupSchedule.timezone}
                    onChange={(e) => setBackupSchedule(prev => ({ ...prev, timezone: e.target.value }))}
                    disabled={!backupSchedule.enabled}
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
                    Backups will be created at the selected time in this timezone
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveBackupSchedule}
                disabled={scheduleSaving || backupSchedule.days.length === 0}
                className="button-primary flex items-center px-6 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scheduleSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4 mr-2" />
                    Save Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Backup Email Recipients */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col justify-between mb-6 md:flex-row md:items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="p-3 bg-primary/10 rounded-2xl mr-4">
              <MailIcon className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-primary">Backup Email Recipients</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage who receives scheduled backup emails
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowRecipientModal(true)}
              className="button-primary flex items-center px-4 py-2 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4 mr-2" /> Add Recipient
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center">
              <div className="p-3 bg-lightred dark:bg-green-900/30 rounded-xl">
                <UsersIcon className="w-8 h-8 text-primary dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Recipients</p>
                <p className="text-2xl font-bold text-primary dark:text-green-400">{recipients.length}</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center">
              <div className="p-3 bg-lightblue dark:bg-purple-900/30 rounded-xl">
                <CheckIcon className="w-8 h-8 text-secondary dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Recipients</p>
                <p className="text-2xl font-bold text-secondary dark:text-purple-400">
                  {recipients.filter(r => r.is_active !== false).length}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                <XIcon className="w-8 h-8 text-yellow-800 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inactive Recipients</p>
                <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">
                  {recipients.filter(r => r.is_active === false).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recipients List */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <h3 className="text-xl font-bold text-primary mb-4">Email Recipients</h3>
          {recipientsLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Loading backup email recipients...</p>
            </div>
          ) : recipients.length > 0 ? (
            <div className="space-y-4">
              {recipients.map(recipient => (
                <div key={recipient.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 bg-lightred dark:bg-gray-700 rounded-full">
                        <MailIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{recipient.email}</h3>
                        <div className="mt-1 flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${recipient.is_active !== false
                              ? 'bg-lightred dark:bg-green-900/40 text-primary dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400'
                            }`}>
                            {recipient.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleActive(recipient)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${recipient.is_active !== false
                            ? 'text-red-600 dark:text-red-400 border border-red-600 dark:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                            : 'text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30'
                          }`}
                      >
                        {recipient.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setEditingRecipient(recipient)}
                        className="text-primary dark:text-blue-400 hover:text-primary-dark dark:hover:text-blue-300 p-1 transition-colors"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecipient(recipient)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 transition-colors"
                        title="Delete recipient"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MailIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              <p className="mt-2 text-gray-600 dark:text-gray-400">No backup email recipients configured</p>
              <button
                onClick={() => setShowRecipientModal(true)}
                className="mt-4 button-primary px-4 py-2 text-sm font-medium"
              >
                Add First Recipient
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SQL Backup Files */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-primary">SQL Backup Files (.sql.gz)</h2>
          <button onClick={loadSqlFiles} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <RefreshCwIcon className="w-4 h-4" />
          </button>
        </div>
        {sqlFiles.length > 0 ? (
          <div className="space-y-3">
            {sqlFiles.map(f => (
              <div key={f.name} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{f.name}</div>
                  <div className="text-gray-500">{new Date(f.modified).toLocaleString()} • {(Number(f.size) / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => handleDownloadSql(f.name)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Download">
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleRestoreSql(f.name)} className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Restore from file">
                    <UploadIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => setFileToDelete(f.name)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete file">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">No SQL backup files found</div>
        )}
      </div>

      {/* Delete File Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Delete Backup File
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete the backup file{' '}
                  <span className="font-semibold text-primary">{fileToDelete}</span>?
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  This file will be permanently removed from the server.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeletingFile}
                  className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSql(fileToDelete)}
                  disabled={isDeletingFile}
                  className="px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                >
                  {isDeletingFile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New Backup
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backup Name *
                </label>
                <input
                  type="text"
                  value={newBackup.name}
                  onChange={(e) => setNewBackup({ ...newBackup, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Monthly Backup - January 2024"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default name provided based on current date and time. You can modify it as needed.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newBackup.description}
                  onChange={(e) => setNewBackup({ ...newBackup, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Brief description of this backup..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateBackupModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={isCreatingBackup || !newBackup.name.trim()}
                className="button-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {isCreatingBackup ? 'Creating...' : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-card max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Restore from Backup
              </h3>

              {/* Source Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Restore Source
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setRestoreSource('upload');
                      setSelectedDownloadedBackup(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${restoreSource === 'upload'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => {
                      setRestoreSource('downloaded');
                      setSelectedFile(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${restoreSource === 'downloaded'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                  >
                    Previously Downloaded
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {restoreSource === 'upload' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload Backup File
                    </label>
                    <input
                      type="file"
                      accept=".json,.sql,.sql.gz"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {selectedFile && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Previously Downloaded Backup
                    </label>
                    {downloadedBackups.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                        {downloadedBackups.map((backup) => (
                          <div
                            key={backup.name}
                            onClick={() => setSelectedDownloadedBackup(backup.name)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedDownloadedBackup === backup.name
                                ? 'bg-primary/10 border-2 border-primary'
                                : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{backup.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(backup.date).toLocaleString()} • {(backup.size / 1024 / 1024).toFixed(2)} MB • {backup.type.toUpperCase()}
                                </p>
                              </div>
                              {selectedDownloadedBackup === backup.name && (
                                <CheckIcon className="w-5 h-5 text-primary" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center border border-gray-300 dark:border-gray-600 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No previously downloaded backups found. Download a backup first to see it here.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Warning: Restoring will overwrite existing data. Make sure you have a current backup.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedFile(null);
                    setSelectedDownloadedBackup(null);
                    setRestoreSource('upload');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={restoreSource === 'upload' ? handleUploadAndRestore : handleRestoreFromDownloaded}
                  disabled={
                    (restoreSource === 'upload' && !selectedFile) ||
                    (restoreSource === 'downloaded' && !selectedDownloadedBackup) ||
                    isRestoring
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && recipientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Delete Recipient
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete the backup email recipient{' '}
                  <span className="font-semibold text-primary">{recipientToDelete.email}</span>?
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  This recipient will no longer receive scheduled backup emails.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRecipientToDelete(null);
                  }}
                  disabled={isDeleting}
                  className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRecipient}
                  disabled={isDeleting}
                  className="px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Recipient Modal */}
      {(showRecipientModal || editingRecipient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-primary">
                {editingRecipient ? 'Edit Recipient' : 'Add Backup Email Recipient'}
              </h3>
              <button
                onClick={() => {
                  setShowRecipientModal(false);
                  setEditingRecipient(null);
                  setNewRecipientEmail('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={editingRecipient ? handleUpdateRecipient : handleAddRecipient}
              className="p-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    placeholder="recipient@example.com"
                    value={editingRecipient ? editingRecipient.email : newRecipientEmail}
                    onChange={(e) => {
                      if (editingRecipient) {
                        setEditingRecipient({ ...editingRecipient, email: e.target.value });
                      } else {
                        setNewRecipientEmail(e.target.value);
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecipientModal(false);
                    setEditingRecipient(null);
                    setNewRecipientEmail('');
                  }}
                  className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecipient || (!editingRecipient && !newRecipientEmail.trim()) || (editingRecipient && !editingRecipient.email.trim())}
                  className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                >
                  {isSubmittingRecipient ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      {editingRecipient ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingRecipient ? 'Update Recipient' : 'Add Recipient'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;
