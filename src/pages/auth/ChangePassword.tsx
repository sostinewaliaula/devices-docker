import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, ArrowLeftIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import AuthLayout, { AuthAlert, AuthBadge, AuthSpinner, PasswordRequirements, authStyles } from '../../components/auth/AuthLayout';

const ChangePassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordChecks = useMemo(() => {
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    const match = !!password && confirmPassword === password;
    return { len, upper, lower, num, special, match };
  }, [password, confirmPassword]);

  const { changePasswordWithCode } = useAuth();
  const { } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Get email and code from location state or redirect
  useEffect(() => {
    const state = location.state as { email?: string; code?: string; verified?: boolean } | null;
    if (state?.email && state?.code && state?.verified) {
      setEmail(state.email);
      setCode(state.code);
    } else {
      navigate('/forgot-password');
    }
  }, [location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      addToast({
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please try again.',
        type: 'error',
        duration: 5000
      });
      setIsLoading(false);
      return;
    }

    if (!(passwordChecks.len && passwordChecks.upper && passwordChecks.lower && passwordChecks.num && passwordChecks.special)) {
      setError('Password does not meet complexity requirements.');
      addToast({
        title: 'Weak Password',
        message: 'Password does not meet complexity requirements.',
        type: 'error',
        duration: 5000
      });
      setIsLoading(false);
      return;
    }

    try {
      await changePasswordWithCode(email, code, password);
      setIsSuccess(true);
      addToast({
        title: 'Password Changed',
        message: 'Your password has been changed successfully.',
        type: 'success',
        duration: 5000
      });

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to change password. Please try again.';
      setError(errorMessage);
      addToast({
        title: 'Change Failed',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title="Password Changed!"
        subtitle="Your password has been changed successfully. Redirecting to login..."
        icon={
          <AuthBadge tone="success">
            <CheckCircleIcon className="w-7 h-7" />
          </AuthBadge>
        }
      >
        <div className="flex justify-center">
          <AuthSpinner />
        </div>
      </AuthLayout>
    );
  }

  const requirementItems = [
    { label: 'At least 8 characters', met: passwordChecks.len },
    { label: 'One uppercase letter', met: passwordChecks.upper },
    { label: 'One lowercase letter', met: passwordChecks.lower },
    { label: 'One number', met: passwordChecks.num },
    { label: 'One special character', met: passwordChecks.special },
    { label: 'Passwords match', met: passwordChecks.match },
  ];

  const eyeBtn = 'absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary';

  return (
    <AuthLayout
      title="Change Password"
      subtitle="Enter your new password below"
      icon={
        <AuthBadge>
          <LockIcon className="w-7 h-7" />
        </AuthBadge>
      }
      footer={
        <Link to="/login" className={`inline-flex items-center justify-center ${authStyles.link}`}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={`${authStyles.label} mb-1`}>New Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authStyles.input} pl-4 pr-12`}
              placeholder="Enter new password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={eyeBtn}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className={`${authStyles.label} mb-1`}>Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${authStyles.input} pl-4 pr-12`}
              placeholder="Confirm new password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className={eyeBtn}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-heading">Password Requirements</p>
          <PasswordRequirements items={requirementItems} />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <button
          type="submit"
          disabled={isLoading || !passwordChecks.len || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.num || !passwordChecks.special || !passwordChecks.match}
          className={authStyles.button}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 mr-2 border-2 rounded-full animate-spin border-on-action/40 border-t-on-action"></div>
              Changing Password...
            </>
          ) : (
            'Change Password'
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ChangePassword;
