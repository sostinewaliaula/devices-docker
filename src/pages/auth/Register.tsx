import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, MailIcon, EyeIcon, EyeOffIcon, UserIcon, PhoneIcon, BriefcaseIcon, Building2Icon } from 'lucide-react';
import { useGoogleConfig } from '../../contexts/GoogleConfigContext';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { Department } from '../../services/apiService';
import ThemeToggle from '../../components/ui/ThemeToggle';
import axios from 'axios';


import { useBranding } from '../../contexts/BrandingContext';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [selectedParentDepartment, setSelectedParentDepartment] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);

  const { register, googleLogin, isAuthenticated, loading: authLoading } = useAuth();
  const { enabled: googleEnabled } = useGoogleConfig();
  const { } = useTheme();
  const { addToast } = useNotifications();
  const { siteName, logoUrl } = useBranding();
  const navigate = useNavigate();

  // Helper to split site name for dual coloring
  const getSiteNameParts = () => {
    if (!siteName) return { first: 'Caava', rest: 'Group' };
    const parts = siteName.split(' ');
    const first = parts[0];
    const rest = parts.slice(1).join(' ');
    // If only one word, show it all in primary
    if (!rest) return { first: siteName, rest: '' };
    return { first, rest };
  };

  const { first: siteNameFirst, rest: siteNameRest } = getSiteNameParts();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/user/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load departments for selection (using direct axios call since user isn't authenticated yet)
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);
        // Use direct axios call without auth token (registration happens before authentication)
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await axios.get(`${API_BASE_URL}/departments`, {
          params: { page: 1, limit: 1000 }
        });
        const deptData = response.data.departments || [];
        setDepartments(deptData.map((d: any) => ({ id: d.id, name: d.name, parent_id: d.parent_id })));

        // Set default parent department to first root (Turnkey, Agencify, Caava AI)
        const roots = deptData.filter((d: any) => !d.parent_id && ['Turnkey', 'Agencify', 'Caava AI'].includes(d.name));
        if (roots.length > 0) {
          setSelectedParentDepartment(roots[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load departments:', err);
        addToast({
          title: 'Error',
          message: err.response?.data?.message || 'Failed to load departments. Please refresh the page.',
          type: 'error',
          duration: 5000,
        });
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, [addToast]);

  useEffect(() => {
    const loadPositions = async () => {
      try {
        setLoadingPositions(true);
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await axios.get(`${API_BASE_URL}/positions`);
        const positionData = response.data?.positions || [];
        setAvailablePositions(positionData.filter((p: any) => p.is_active !== false).map((p: any) => p.name));
      } catch (err: any) {
        console.error('Failed to load positions:', err);
        addToast({
          title: 'Error',
          message: err.response?.data?.message || 'Failed to load positions. Please refresh the page.',
          type: 'error',
          duration: 5000,
        });
      } finally {
        setLoadingPositions(false);
      }
    };

    loadPositions();
  }, [addToast]);

  // Show nothing while checking auth status
  if (authLoading) {
    return null;
  }

  // Redirect if authenticated
  if (isAuthenticated) {
    return <Navigate to="/user/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!position || position.trim() === '') {
      setError('Please select a position');
      return;
    }

    if (!selectedParentDepartment || selectedParentDepartment.trim() === '') {
      setError('Please select a parent department');
      return;
    }

    if (!departmentId || departmentId.trim() === '') {
      setError('Please select a department');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        email,
        password,
        name,
        phone: phone || undefined,
        position: position, // Required field
        department_id: departmentId, // Required field
      });

      addToast({
        title: 'Registration Successful',
        message: 'Your account has been created successfully!',
        type: 'success',
        duration: 3000,
      });

      // Redirect to appropriate dashboard based on role (should be 'user')
      navigate('/user/dashboard', { replace: true });
    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      addToast({
        title: 'Registration Failed',
        message: errorMessage,
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (msg = 'Google sign-in failed. Please try again.') => {
    setError(msg);
    addToast({ title: 'Sign-in Failed', message: msg, type: 'error', duration: 5000 });
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (!result.profile_complete) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      addToast({ title: 'Sign-in Successful', message: 'Welcome!', type: 'success', duration: 3000 });
      navigate('/user/dashboard', { replace: true });
    } catch (err: any) {
      handleGoogleError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
      <div className="flex-1 h-full max-w-4xl mx-auto overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col overflow-y-auto md:flex-row">
          <div className="h-32 md:h-auto md:w-1/2">
            <img
              aria-hidden="true"
              className="object-cover w-full h-full rounded-l-2xl"
              src="https://i.ibb.co/zWhdQPHQ/Themabeeld-ITSAM-1-2048x1363-1-1.png"
              alt="Office"
            />
          </div>
          <div className="flex items-center justify-center p-6 sm:p-12 md:w-1/2">
            <div className="w-full">
              <div className="flex justify-end mb-4">
                <ThemeToggle />
              </div>
              <div className="flex flex-col items-center mb-8">
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="h-12 w-auto mb-2"
                />
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-primary">{siteNameFirst}</h1>
                  {siteNameRest && <h1 className="ml-2 text-2xl font-bold text-secondary">{siteNameRest}</h1>}
                </div>
              </div>
              <h1 className="mb-4 text-xl font-bold text-primary dark:text-primary">
                Create Account
              </h1>
              {error && (
                <div className="px-4 py-2 mb-4 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Name */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Full Name</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <UserIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        placeholder="John Doe"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  {/* Email */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Email</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <MailIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        placeholder="your@email.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  {/* Phone */}
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

                  {/* Position */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Position</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <BriefcaseIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <select
                        className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        required
                        disabled={loadingPositions || availablePositions.length === 0}
                      >
                        <option value="">
                          {loadingPositions ? 'Loading positions...' : availablePositions.length ? 'Select Position' : 'No positions available'}
                        </option>
                        {availablePositions.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  {/* Parent Department */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Parent Department</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Building2Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <select
                        className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        value={selectedParentDepartment}
                        onChange={(e) => {
                          setSelectedParentDepartment(e.target.value);
                          setDepartmentId(''); // Reset department when parent changes
                        }}
                        disabled={loadingDepartments}
                        required
                      >
                        <option value="">Select Parent Department</option>
                        {departments
                          .filter((d) => !d.parent_id && ['Turnkey', 'Agencify', 'Caava AI'].includes(d.name))
                          .map((root) => (
                            <option key={root.id} value={root.id}>
                              {root.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </label>

                  {/* Department */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Department</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Building2Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <select
                        className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-select focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={loadingDepartments || !selectedParentDepartment}
                        required
                      >
                        <option value="">Select Department</option>
                        {/* Option to assign to root itself */}
                        {departments
                          .filter((d) => d.id === selectedParentDepartment)
                          .map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} (Root)
                            </option>
                          ))}
                        {/* Sub-departments under selected parent */}
                        {departments
                          .filter((d) => d.parent_id === selectedParentDepartment)
                          .map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </label>

                  {/* Password */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Password</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <LockIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        className="block w-full pl-10 pr-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        placeholder="************"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-300 hover:text-primary"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOffIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </label>

                  {/* Confirm Password */}
                  <label className="block text-sm">
                    <span className="text-primary dark:text-primary">Confirm Password</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <LockIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <input
                        className="block w-full pl-10 pr-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                        placeholder="************"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-300 hover:text-primary"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <EyeOffIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </label>
                </div>

                {/* Terms agreement */}
                <div className="mt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={e => setAgreedToTerms(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                        {agreedToTerms && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 10">
                            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      I have read and agree to the{' '}
                      <Link to="/terms" target="_blank" className="text-primary font-medium hover:underline">Terms of Service</Link>
                      {' '}and{' '}
                      <Link to="/privacy" target="_blank" className="text-secondary font-medium hover:underline">Privacy Policy</Link>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="button-primary block w-full px-4 py-2 mt-4 text-sm font-medium leading-5 text-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || loadingDepartments || !agreedToTerms}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>
              {googleEnabled && agreedToTerms && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or sign up with</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={() => handleGoogleError()} label="Sign up with Google" />
                  </div>
                </>
              )}
              <hr className="my-8" />
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-secondary hover:underline font-medium"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

