import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import ThemeToggle from '../../components/ui/ThemeToggle';
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
      <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
        <div className="flex-1 h-full max-w-4xl mx-auto overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-gray-600 dark:text-gray-300">Verifying recovery link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid
  if (!isValidToken) {
    return (
      <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
        <div className="flex-1 h-full max-w-4xl mx-auto overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-center p-12">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Invalid Recovery Link
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                This password recovery link is invalid or has expired. Please request a new password reset.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Request New Reset
              </Link>
              <div className="mt-4">
                <Link
                  className="text-sm text-secondary hover:underline"
                  to="/login"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                <img src="http://ticket.turnkey.local:8080/scp/logo.php?login" alt="Caava Group" className="h-12 w-auto mb-2" />
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-primary">Caava</h1>
                  <h1 className="ml-2 text-2xl font-bold text-secondary">Group</h1>
                </div>
              </div>
              <h1 className="mb-4 text-xl font-bold text-primary dark:text-primary">
                Reset Password
              </h1>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                Enter your new password below. Make sure it's at least 8 characters long.
              </p>
              {error && (
                <div className="px-4 py-2 mb-4 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md">
                  {error}
                </div>
              )}
              {message && (
                <div className="px-4 py-2 mb-4 text-sm text-primary bg-lightred dark:bg-green-900 dark:text-green-200 rounded-md">
                  {message}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <label className="block text-sm">
                  <span className="text-gray-700 dark:text-gray-300">New Password</span>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <LockIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                      placeholder="************"
                      type={showNew ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowNew(s => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">{showNew ? 'Hide' : 'Show'}</button>
                  </div>
                </label>
                {/* Requirements indicator */}
                <ul className="mt-2 space-y-1 text-xs">
                  <li className={`${passwordChecks.len ? 'text-green-600' : 'text-gray-500'}`}>At least 8 characters</li>
                  <li className={`${passwordChecks.upper ? 'text-green-600' : 'text-gray-500'}`}>Contains an uppercase letter</li>
                  <li className={`${passwordChecks.lower ? 'text-green-600' : 'text-gray-500'}`}>Contains a lowercase letter</li>
                  <li className={`${passwordChecks.num ? 'text-green-600' : 'text-gray-500'}`}>Contains a number</li>
                  <li className={`${passwordChecks.special ? 'text-green-600' : 'text-gray-500'}`}>Contains a special character</li>
                </ul>
                <label className="block mt-4 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Confirm Password</span>
                  <div className="relative mt-1">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <LockIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40"
                      placeholder="************"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700">{showConfirm ? 'Hide' : 'Show'}</button>
                  </div>
                </label>
                {confirmPassword && (
                  <div className={`mt-2 text-xs ${passwordChecks.match ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordChecks.match ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
                <button
                  type="submit"
                  className="button-primary block w-full px-4 py-2 mt-4 text-sm font-medium leading-5 text-center"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
              <hr className="my-8" />
              <p className="mt-4">
                <Link
                  className="text-sm font-medium text-secondary hover:underline"
                  to="/login"
                >
                  Back to Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
