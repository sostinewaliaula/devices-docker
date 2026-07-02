import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, ArrowLeftIcon, CheckCircleIcon } from 'lucide-react';
import logo from '../../assets/logo.png';
import ThemeToggle from '../../components/ui/ThemeToggle';

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
      <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Password Changed!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your password has been changed successfully. Redirecting to login...
            </p>
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
      <div className="w-full max-w-md mx-auto">
        {/* Theme Toggle */}
        <div className="flex justify-end mb-6">
          <ThemeToggle />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="mb-6">
              <img
                src={logo}
                alt="Caava Group Logo"
                className="h-16 w-auto mx-auto"
              />
            </div>

            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <LockIcon className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Change Password
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  placeholder="Enter new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  placeholder="Confirm new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password Requirements:</p>
              <div className="space-y-1 text-sm">
                <div className={`flex items-center ${passwordChecks.len ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.len ? '✓' : '○'}</span>
                  At least 8 characters
                </div>
                <div className={`flex items-center ${passwordChecks.upper ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.upper ? '✓' : '○'}</span>
                  One uppercase letter
                </div>
                <div className={`flex items-center ${passwordChecks.lower ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.lower ? '✓' : '○'}</span>
                  One lowercase letter
                </div>
                <div className={`flex items-center ${passwordChecks.num ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.num ? '✓' : '○'}</span>
                  One number
                </div>
                <div className={`flex items-center ${passwordChecks.special ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.special ? '✓' : '○'}</span>
                  One special character
                </div>
                <div className={`flex items-center ${passwordChecks.match ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span className="w-4 h-4 mr-2">{passwordChecks.match ? '✓' : '○'}</span>
                  Passwords match
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !passwordChecks.len || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.num || !passwordChecks.special || !passwordChecks.match}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/login"
              className="flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
