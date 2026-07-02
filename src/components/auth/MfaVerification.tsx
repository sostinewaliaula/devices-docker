import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { ShieldCheckIcon, ArrowLeftIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react';

interface MfaVerificationProps {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  onBack: () => void;
  onSuccess: () => void;
}

const MfaVerification: React.FC<MfaVerificationProps> = ({
  userId,
  user,
  onBack,
  onSuccess
}) => {
  const { verifyMfaLogin, listMfaFactors } = useAuth();
  const { addToast } = useNotifications();

  const [mfaCode, setMfaCode] = useState('');
  const [factors, setFactors] = useState<Array<{ id: string; type: string; friendlyName?: string; status?: string }>>([]);
  const [selectedFactor, setSelectedFactor] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  // Load user's MFA factors
  useEffect(() => {
    const loadFactors = async () => {
      try {
        // Use the new endpoint that doesn't require authentication
        const response = await fetch('/api/auth/mfa-factors-for-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId
          })
        });

        if (response.ok) {
          const data = await response.json();
          setFactors(data.factors);

          if (data.factors.length > 0) {
            setSelectedFactor(data.factors[0].id);
          } else {
            // No MFA factors found - user needs to set up MFA first
            // console.log('No MFA factors found, user needs to set up MFA');
            setFactors([]);
          }
        } else {
          console.error('Failed to load MFA factors:', response.status);
          // If we can't get factors, we'll assume the user has at least one factor
          setFactors([{ id: 'default', type: 'totp', friendlyName: 'Authenticator', status: 'verified' }]);
          setSelectedFactor('default');
        }
      } catch (error) {
        console.error('Error loading MFA factors:', error);
        // Don't show error toast during login flow, just proceed
        setFactors([{ id: 'default', type: 'totp', friendlyName: 'Authenticator', status: 'verified' }]);
        setSelectedFactor('default');
      }
    };

    loadFactors();
  }, [userId, addToast]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useRecoveryCode) {
      if (!recoveryCode.trim()) {
        setError('Please enter a recovery code');
        return;
      }
    } else {
      if (!mfaCode.trim() || !selectedFactor) {
        setError('Please enter the verification code and select an authenticator');
        return;
      }
    }

    setIsVerifying(true);
    setError(null);

    try {
      if (useRecoveryCode) {
        // Use recovery code verification through the MFA login endpoint
        await verifyMfaLogin(userId, 'recovery-code', recoveryCode.trim());
      } else {
        await verifyMfaLogin(userId, selectedFactor, mfaCode.trim());
      }

      addToast('Verification successful!', 'success');
      onSuccess();
    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error.message || 'Verification failed. Please try again.');
      addToast('Verification failed', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setMfaCode(value);
      setError(null);
    }
  };

  if (factors.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-indigo-600" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              MFA Setup Required
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Your account requires Multi-Factor Authentication (MFA) to be enabled for security.
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Please log in to your account and set up MFA in the Settings page.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Security Policy Requirement
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>
                      Your organization requires MFA to be enabled. You cannot log in until you set up MFA.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={onBack}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Login
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Contact your administrator if you need help setting up MFA.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-indigo-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter the verification code from your authenticator app
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Logging in as <span className="font-medium">{user.email}</span>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleVerify}>
          <div className="space-y-4">
            {/* Toggle between MFA and Recovery Code */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
              <button
                type="button"
                onClick={() => setUseRecoveryCode(false)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${!useRecoveryCode
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                Authenticator App
              </button>
              <button
                type="button"
                onClick={() => setUseRecoveryCode(true)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${useRecoveryCode
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                <KeyIcon className="w-4 h-4 inline mr-1" />
                Recovery Code
              </button>
            </div>

            {!useRecoveryCode ? (
              <>
                {/* Authenticator Selection */}
                {factors.length > 1 && (
                  <div>
                    <label htmlFor="factor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Authenticator
                    </label>
                    <select
                      id="factor"
                      value={selectedFactor}
                      onChange={(e) => setSelectedFactor(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {factors.map((factor) => (
                        <option key={factor.id} value={factor.id}>
                          {factor.friendlyName || factor.type} ({factor.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Verification Code Input */}
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                  </label>
                  <input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    value={mfaCode}
                    onChange={handleCodeChange}
                    placeholder="123456"
                    maxLength={6}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-widest"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
              </>
            ) : (
              /* Recovery Code Input */
              <div>
                <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recovery Code
                </label>
                <input
                  id="recoveryCode"
                  name="recoveryCode"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="ABCD-EFGH-IJKL"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-center text-lg font-mono tracking-wider"
                  autoComplete="off"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter one of your recovery codes (each can only be used once)
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
              <div className="text-sm text-red-700 dark:text-red-200">
                {error}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isVerifying}
              className="flex-1 flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </button>

            <button
              type="submit"
              disabled={isVerifying || (!useRecoveryCode && mfaCode.length !== 6) || (useRecoveryCode && !recoveryCode.trim())}
              className="flex-1 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                useRecoveryCode ? 'Verify Recovery Code' : 'Verify & Login'
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Having trouble? Make sure your device's time is synchronized
          </p>
        </div>
      </div>
    </div>
  );
};

export default MfaVerification;
