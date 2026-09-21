import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import AuthLayout, { AuthAlert, AuthBadge, AuthSpinner, PasswordRequirements, authStyles } from '../../components/auth/AuthLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, AlertCircleIcon } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passwordChecks = useMemo(() => {
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const num = /[0-9]/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    const match = !!password && confirmPassword === password;
    return { len, upper, lower, num, special, match };
  }, [password, confirmPassword]);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const { resetPassword, validateResetToken } = useAuth();
  const { } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we have a valid recovery token
  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        const token = searchParams.get('token');

        if (!token) {
          setIsValidToken(false);
          setIsCheckingToken(false);
          return;
        }

        const result = await validateResetToken(token);
        setIsValidToken(result.valid);
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
      } finally {
        setIsCheckingToken(false);
      }
    };

    checkRecoveryToken();
  }, [searchParams, validateResetToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidToken) {
      setError('Invalid or expired recovery link. Please request a new password reset.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      addToast({
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please try again.',
        type: 'error',
        duration: 5000
      });
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
      return;
    }

    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const token = searchParams.get('token');
      if (!token) {
        throw new Error('No reset token found');
      }

      await resetPassword(token, password);
      setMessage('Password has been reset successfully.');
      addToast({
        title: 'Password Reset',
        message: 'Your password has been reset successfully.',
        type: 'success',
        duration: 5000
      });

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
      addToast({
        title: 'Reset Failed',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (isCheckingToken) {
    return (
      <AuthLayout title="Verifying recovery link..." subtitle="This will only take a moment.">
        <div className="flex justify-center py-2">
          <AuthSpinner className="w-10 h-10" />
        </div>
      </AuthLayout>
    );
  }

  // Show error if token is invalid
  if (!isValidToken) {
    return (
      <AuthLayout
        title="Invalid Recovery Link"
        subtitle="This password recovery link is invalid or has expired. Please request a new password reset."
        icon={
          <AuthBadge tone="error">
            <AlertCircleIcon className="w-7 h-7" />
          </AuthBadge>
        }
        footer={<Link className={authStyles.link} to="/login">Back to Login</Link>}
      >
        <Link to="/forgot-password" className={authStyles.button}>
          Request New Reset
        </Link>
      </AuthLayout>
    );
  }

  const requirementItems = [
    { label: 'At least 8 characters', met: passwordChecks.len },
    { label: 'Contains an uppercase letter', met: passwordChecks.upper },
    { label: 'Contains a lowercase letter', met: passwordChecks.lower },
    { label: 'Contains a number', met: passwordChecks.num },
    { label: 'Contains a special character', met: passwordChecks.special },
  ];

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your new password below. Make sure it's at least 8 characters long."
      footer={<Link className={authStyles.link} to="/login">Back to Login</Link>}
    >
      {error && <AuthAlert className="mb-4">{error}</AuthAlert>}
      {message && <AuthAlert tone="success" className="mb-4">{message}</AuthAlert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={authStyles.label}>New Password</span>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <LockIcon className={authStyles.iconInInput} />
            </div>
            <input
              className={`${authStyles.input} pl-11 pr-16`}
              placeholder="************"
              type={showNew ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowNew(s => !s)} className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-muted hover:text-primary">{showNew ? 'Hide' : 'Show'}</button>
          </div>
        </label>
        <PasswordRequirements items={requirementItems} />
        <label className="block">
          <span className={authStyles.label}>Confirm Password</span>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <LockIcon className={authStyles.iconInInput} />
            </div>
            <input
              className={`${authStyles.input} pl-11 pr-16`}
              placeholder="************"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-muted hover:text-primary">{showConfirm ? 'Hide' : 'Show'}</button>
          </div>
        </label>
        {confirmPassword && (
          <div className={`text-xs font-medium ${passwordChecks.match ? 'text-heading' : 'text-primary'}`}>
            {passwordChecks.match ? '✓ Passwords match' : 'Passwords do not match'}
          </div>
        )}
        <button type="submit" className={authStyles.button} disabled={isLoading}>
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
