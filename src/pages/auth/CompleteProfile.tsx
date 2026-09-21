import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BriefcaseIcon, Building2Icon, PhoneIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import AuthLayout, { AuthAlert, authStyles } from '../../components/auth/AuthLayout';
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
  const navigate = useNavigate();

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

  const ico = 'absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none';

  return (
    <AuthLayout
      size="lg"
      title="Complete Your Profile"
      subtitle={`Hi ${user?.name?.split(' ')[0] || 'there'}! Just a few more details to get you set up.`}
    >
      {error && <AuthAlert className="mb-4">{error}</AuthAlert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Position */}
        <label className="block">
          <span className={authStyles.label}>Position <span className="text-primary">*</span></span>
          <div className="relative mt-1">
            <div className={ico}><BriefcaseIcon className={authStyles.iconInInput} /></div>
            <select
              className={`${authStyles.input} pl-11 pr-4`}
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
        <label className="block">
          <span className={authStyles.label}>Parent Department <span className="text-primary">*</span></span>
          <div className="relative mt-1">
            <div className={ico}><Building2Icon className={authStyles.iconInInput} /></div>
            <select
              className={`${authStyles.input} pl-11 pr-4`}
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
        <label className="block">
          <span className={authStyles.label}>Department <span className="text-primary">*</span></span>
          <div className="relative mt-1">
            <div className={ico}><Building2Icon className={authStyles.iconInInput} /></div>
            <select
              className={`${authStyles.input} pl-11 pr-4`}
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
        <label className="block">
          <span className={authStyles.label}>Phone (Optional)</span>
          <div className="relative mt-1">
            <div className={ico}><PhoneIcon className={authStyles.iconInInput} /></div>
            <input
              className={`${authStyles.input} pl-11 pr-4`}
              placeholder="+1234567890"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </label>

        <button
          type="submit"
          className={`${authStyles.button} !mt-6`}
          disabled={isLoading || loadingDepts || loadingPositions}
        >
          {isLoading ? 'Saving...' : 'Complete Setup'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default CompleteProfile;
