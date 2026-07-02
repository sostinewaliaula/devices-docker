import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BriefcaseIcon, Building2Icon, PhoneIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBranding } from '../../contexts/BrandingContext';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { Department } from '../../services/apiService';

const CompleteProfile: React.FC = () => {
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedParentDepartment, setSelectedParentDepartment] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { user, completeGoogleProfile } = useAuth();
  const { addToast } = useNotifications();
  const { siteName, logoUrl } = useBranding();
  const navigate = useNavigate();

  const getSiteNameParts = () => {
    if (!siteName) return { first: 'Caava', rest: 'Group' };
    const parts = siteName.split(' ');
    const first = parts[0];
    const rest = parts.slice(1).join(' ');
    if (!rest) return { first: siteName, rest: '' };
    return { first, rest };
  };
  const { first: siteNameFirst, rest: siteNameRest } = getSiteNameParts();

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const loadDepts = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/departments`, { params: { page: 1, limit: 1000 } });
        const deptData = res.data.departments || [];
        setDepartments(deptData.map((d: any) => ({ id: d.id, name: d.name, parent_id: d.parent_id })));
        const roots = deptData.filter((d: any) => !d.parent_id && ['Turnkey', 'Agencify', 'Caava AI'].includes(d.name));
        if (roots.length > 0) setSelectedParentDepartment(roots[0].id);
      } catch { /* non-fatal */ } finally {
        setLoadingDepts(false);
      }
    };
    const loadPositions = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/positions`);
        const posData = res.data?.positions || [];
        setAvailablePositions(posData.filter((p: any) => p.is_active !== false).map((p: any) => p.name));
      } catch { /* non-fatal */ } finally {
        setLoadingPositions(false);
      }
    };
    loadDepts();
    loadPositions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!position) { setError('Please select a position'); return; }
    if (!selectedParentDepartment) { setError('Please select a parent department'); return; }
    if (!departmentId) { setError('Please select a department'); return; }

    setIsLoading(true);
    try {
      await completeGoogleProfile({ position, department_id: departmentId, phone: phone || undefined });
      addToast({ title: 'Profile Complete', message: 'Welcome! Your profile is set up.', type: 'success', duration: 3000 });
      navigate('/user/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
      <div className="flex-1 h-full max-w-lg mx-auto overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="p-8">
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          <div className="flex flex-col items-center mb-6">
            <img src={logoUrl} alt={siteName} className="h-12 w-auto mb-2" />
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">{siteNameFirst}</h1>
              {siteNameRest && <h1 className="ml-2 text-2xl font-bold text-secondary">{siteNameRest}</h1>}
            </div>
          </div>

          <h2 className="text-xl font-bold text-primary mb-1">Complete Your Profile</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Hi {user?.name?.split(' ')[0] || 'there'}! Just a few more details to get you set up.
          </p>

          {error && (
            <div className="px-4 py-2 mb-4 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Position */}
            <label className="block text-sm">
              <span className="text-primary dark:text-primary">Position <span className="text-red-500">*</span></span>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <BriefcaseIcon className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                  disabled={loadingPositions}
                >
                  <option value="">{loadingPositions ? 'Loading positions...' : 'Select Position'}</option>
                  {availablePositions.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </label>

            {/* Parent Department */}
            <label className="block text-sm">
              <span className="text-primary dark:text-primary">Parent Department <span className="text-red-500">*</span></span>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Building2Icon className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                  value={selectedParentDepartment}
                  onChange={(e) => { setSelectedParentDepartment(e.target.value); setDepartmentId(''); }}
                  disabled={loadingDepts}
                  required
                >
                  <option value="">Select Parent Department</option>
                  {departments
                    .filter((d) => !d.parent_id && ['Turnkey', 'Agencify', 'Caava AI'].includes(d.name))
                    .map((root) => (
                      <option key={root.id} value={root.id}>{root.name}</option>
                    ))}
                </select>
              </div>
            </label>

            {/* Department */}
            <label className="block text-sm">
              <span className="text-primary dark:text-primary">Department <span className="text-red-500">*</span></span>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Building2Icon className="w-5 h-5 text-gray-400" />
                </div>
                <select
                  className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={loadingDepts || !selectedParentDepartment}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.filter((d) => d.id === selectedParentDepartment).map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                  ))}
                  {departments.filter((d) => d.parent_id === selectedParentDepartment).map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </label>

            {/* Phone (optional) */}
            <label className="block text-sm">
              <span className="text-primary dark:text-primary">Phone (Optional)</span>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <PhoneIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                  placeholder="+1234567890"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </label>

            <button
              type="submit"
              className="button-primary block w-full px-4 py-2 mt-4 text-sm font-medium leading-5 text-center"
              disabled={isLoading || loadingDepts || loadingPositions}
            >
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
