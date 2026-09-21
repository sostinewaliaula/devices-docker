import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, MailIcon, EyeIcon, EyeOffIcon, UserIcon, PhoneIcon, BriefcaseIcon, Building2Icon } from 'lucide-react';
import { useGoogleConfig } from '../../contexts/GoogleConfigContext';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { Department } from '../../services/apiService';
import AuthLayout, { AuthAlert, AuthDivider, authStyles } from '../../components/auth/AuthLayout';
import axios from 'axios';


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
  // Google is the default sign-up path; the email/password form is revealed on demand
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);

  const { register, googleLogin, isAuthenticated, loading: authLoading } = useAuth();
  const { enabled: googleEnabled, loaded: googleLoaded } = useGoogleConfig();
  // Without Google there'd be no way in, so the email form is always shown then
  const emailFormVisible = !googleEnabled || showEmailForm;
  const { } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

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

  const ico = 'absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none';
  const eyeBtn = 'absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-primary';

  return (
    <AuthLayout
      size="lg"
      title="Create your account"
      subtitle="Get started in a few seconds"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={authStyles.link}>Sign in</Link>
        </>
      }
    >
      {error && <AuthAlert className="mb-4">{error}</AuthAlert>}
      {!googleLoaded ? (
        // Reserve space while we learn whether Google is enabled, so the form doesn't flash in and out
        <div className="h-40" aria-busy="true" />
      ) : (
        <>
          {googleEnabled && (
            <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={() => handleGoogleError()} label="Sign up with Google" />
          )}
          {googleEnabled && !showEmailForm && (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className={`block w-full mt-5 text-sm text-center ${authStyles.link}`}
            >
              Sign up with email and password instead
            </button>
          )}
          {googleEnabled && showEmailForm && <AuthDivider>or sign up with email</AuthDivider>}
          {emailFormVisible && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Name */}
                <label className="block">
                  <span className={authStyles.label}>Full Name</span>
                  <div className="relative mt-1">
                    <div className={ico}><UserIcon className={authStyles.iconInInput} /></div>
                    <input
                      className={`${authStyles.input} pl-11 pr-4`}
                      placeholder="John Doe"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus={googleEnabled}
                      required
                    />
                  </div>
                </label>

                {/* Email */}
                <label className="block">
                  <span className={authStyles.label}>Email</span>
                  <div className="relative mt-1">
                    <div className={ico}><MailIcon className={authStyles.iconInInput} /></div>
                    <input
                      className={`${authStyles.input} pl-11 pr-4`}
                      placeholder="your@email.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </label>

                {/* Phone */}
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

                {/* Position */}
                <label className="block">
                  <span className={authStyles.label}>Position</span>
                  <div className="relative mt-1">
                    <div className={ico}><BriefcaseIcon className={authStyles.iconInInput} /></div>
                    <select
                      className={`${authStyles.input} pl-11 pr-4`}
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
                <label className="block">
                  <span className={authStyles.label}>Parent Department</span>
                  <div className="relative mt-1">
                    <div className={ico}><Building2Icon className={authStyles.iconInInput} /></div>
                    <select
                      className={`${authStyles.input} pl-11 pr-4`}
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
                <label className="block">
                  <span className={authStyles.label}>Department</span>
                  <div className="relative mt-1">
                    <div className={ico}><Building2Icon className={authStyles.iconInInput} /></div>
                    <select
                      className={`${authStyles.input} pl-11 pr-4`}
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
                <label className="block">
                  <span className={authStyles.label}>Password</span>
                  <div className="relative mt-1">
                    <div className={ico}><LockIcon className={authStyles.iconInInput} /></div>
                    <input
                      className={`${authStyles.input} pl-11 pr-11`}
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
                      className={eyeBtn}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </label>

                {/* Confirm Password */}
                <label className="block">
                  <span className={authStyles.label}>Confirm Password</span>
                  <div className="relative mt-1">
                    <div className={ico}><LockIcon className={authStyles.iconInInput} /></div>
                    <input
                      className={`${authStyles.input} pl-11 pr-11`}
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
                      className={eyeBtn}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                className={`${authStyles.button} !mt-6`}
                disabled={isLoading || loadingDepartments}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </>
      )}
      <p className="mt-6 text-xs leading-relaxed text-center text-muted">
        By continuing, you agree to our{' '}
        <Link to="/terms" target="_blank" className={authStyles.link}>Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" target="_blank" className={authStyles.link}>Privacy Policy</Link>.
      </p>
    </AuthLayout>
  );
};

export default Register;
