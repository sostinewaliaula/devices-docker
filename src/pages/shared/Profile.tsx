import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { authAPI, Department } from '../../services/apiService';
import { useNotifications } from '../../contexts/NotificationContext';
import { UserIcon, SettingsIcon, Edit2Icon, SaveIcon, XIcon, CheckCircleIcon, EyeIcon, EyeOffIcon, XCircleIcon } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { addToast } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    position: user?.position || '',
    email: user?.email || '',
    department_id: user?.department_id || ''
  });
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);


  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordChecks = useMemo(() => {
    const len = newPassword.length >= 8;
    const upper = /[A-Z]/.test(newPassword);
    const lower = /[a-z]/.test(newPassword);
    const num = /[0-9]/.test(newPassword);
    const special = /[^A-Za-z0-9]/.test(newPassword);
    const match = !!newPassword && confirmPassword === newPassword;
    return { len, upper, lower, num, special, match };
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    const fetchData = async () => {
      setPositionsLoading(true);
      setDepartmentsLoading(true);
      try {
        const [posRes, deptRes] = await Promise.all([
          authAPI.getPositions(),
          authAPI.getDepartments()
        ]);
        setPositions(posRes.positions);
        setDepartments(deptRes.departments);
      } catch (err) {
        console.error('Failed to fetch positions or departments:', err);
      } finally {
        setPositionsLoading(false);
        setDepartmentsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to organize departments into a hierarchy for display
  const sortedDepartments = useMemo(() => {
    if (!departments.length) return [];

    const result: { id: string; displayName: string }[] = [];

    // Separate primary and sub departments
    const primary = departments.filter(d => !d.parent_id);
    const sub = departments.filter(d => d.parent_id);

    primary.sort((a, b) => a.name.localeCompare(b.name)).forEach(parent => {
      result.push({ id: parent.id, displayName: parent.name });

      // Find sub-departments
      const children = sub.filter(s => s.parent_id === parent.id);
      children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => {
        result.push({ id: child.id, displayName: `— ${child.name}` });
      });
    });

    // Add any sub-departments whose parents weren't found (orphan sub-depts)
    const processedIds = new Set(result.map(r => r.id));
    departments.forEach(d => {
      if (!processedIds.has(d.id)) {
        result.push({ id: d.id, displayName: d.name });
      }
    });

    return result;
  }, [departments]);

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Please log in to view your profile.
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Revert changes if cancelling
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        position: user.position || '',
        email: user.email || '',
        department_id: user.department_id || ''
      });
      setError(null);
    }
    setIsEditing(!isEditing);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await updateProfile(formData);
      addToast({
        title: 'Success',
        message: 'Profile updated successfully!',
        type: 'success'
      });
      setIsEditing(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update profile';
      setError(errorMessage);
      addToast({
        title: 'Error',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast({ title: 'Missing fields', message: 'Please fill in all password fields.', type: 'warning' });
      return;
    }
    if (!(passwordChecks.len && passwordChecks.upper && passwordChecks.lower && passwordChecks.num && passwordChecks.special)) {
      addToast({ title: 'Weak password', message: 'Password does not meet complexity requirements.', type: 'warning' });
      return;
    }
    if (!passwordChecks.match) {
      addToast({ title: 'Password mismatch', message: 'New password and confirmation do not match.', type: 'error' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await authAPI.changePassword(currentPassword, newPassword);
      addToast({ title: 'Success', message: res.message || 'Your password has been changed successfully.', type: 'success' });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong.';
      addToast({ title: 'Update failed', message: msg, type: 'error' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage your account information.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleEditToggle}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-xl hover:opacity-90 transition-opacity"
          >
            {isEditing ? (
              <><XIcon className="w-4 h-4 mr-2" /> Cancel</>
            ) : (
              <><Edit2Icon className="w-4 h-4 mr-2" /> Edit Profile</>
            )}
          </button>
          <Link
            to="/settings"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:opacity-90 transition-opacity"
          >
            <SettingsIcon className="w-4 h-4 mr-2" /> Settings
          </Link>
        </div>
      </div>



      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center mb-8">
          <div className="p-4 mr-6 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 shadow-sm">
            <UserIcon className="w-12 h-12" />
          </div>
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {user.name || 'Unnamed User'}
              </h2>
              <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-lightred text-primary uppercase tracking-wider">
                {user.role === 'admin' ? 'Administrator' : (user.role || 'User')}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">{user.email}</p>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="e.g. +254 712 345678"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Position / Title</label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  disabled={positionsLoading}
                >
                  <option value="">Select a position</option>
                  {positions.map(pos => (
                    <option key={pos.id} value={pos.name}>
                      {pos.name}
                    </option>
                  ))}
                </select>
                {positionsLoading && <p className="text-xs text-gray-500 mt-1">Loading positions...</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                  Department {user.role === 'manager' && '(Fixed for Managers)'}
                </label>
                <select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${user.role === 'manager' ? 'cursor-not-allowed opacity-75' : ''}`}
                  disabled={departmentsLoading || user.role === 'manager'}
                >
                  <option value="">Select a department</option>
                  {sortedDepartments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.displayName}
                    </option>
                  ))}
                </select>
                {departmentsLoading && <p className="text-xs text-gray-500 mt-1">Loading departments...</p>}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-3 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <><SaveIcon className="w-4 h-4 mr-2" /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">User ID</p>
              <p className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{user.id}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Joined</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Last Updated</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.updated_at ? new Date(user.updated_at).toLocaleString() : 'Never'}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Position</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.position || 'Not set'}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Phone</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.phone || 'Not set'}</p>
            </div>
            <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Department</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.department_name || 'No department'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Change Password</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">Update your account password. Make sure to use a strong password.</p>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full pr-10 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">
                {showCurrent ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full pr-10 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Strong password"
              />
              <button type="button" onClick={() => setShowNew(s => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">
                {showNew ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {/* Requirements indicator */}
            <ul className="mt-2 space-y-1 text-xs">
              <li className={`flex items-center ${passwordChecks.len ? 'text-green-600' : 'text-gray-500'}`}>
                {passwordChecks.len ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />} At least 8 characters
              </li>
              <li className={`flex items-center ${passwordChecks.upper ? 'text-green-600' : 'text-gray-500'}`}>
                {passwordChecks.upper ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />} Contains an uppercase letter
              </li>
              <li className={`flex items-center ${passwordChecks.lower ? 'text-green-600' : 'text-gray-500'}`}>
                {passwordChecks.lower ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />} Contains a lowercase letter
              </li>
              <li className={`flex items-center ${passwordChecks.num ? 'text-green-600' : 'text-gray-500'}`}>
                {passwordChecks.num ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />} Contains a number
              </li>
              <li className={`flex items-center ${passwordChecks.special ? 'text-green-600' : 'text-gray-500'}`}>
                {passwordChecks.special ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />} Contains a special character
              </li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pr-10 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Re-enter new password"
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">
                {showConfirm ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && (
              <div className={`mt-2 text-xs flex items-center ${passwordChecks.match ? 'text-green-600' : 'text-red-600'}`}>
                {passwordChecks.match ? <CheckCircleIcon className="w-4 h-4 mr-1" /> : <XCircleIcon className="w-4 h-4 mr-1" />}
                {passwordChecks.match ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
