import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { ShieldCheckIcon, ArrowLeftIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react';
import AuthLayout, { AuthAlert, AuthBadge, authStyles } from './AuthLayout';

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
      <AuthLayout
        title="MFA Setup Required"
        subtitle="Your account requires Multi-Factor Authentication (MFA) to be enabled for security. Please log in to your account and set up MFA in the Settings page."
        icon={
          <AuthBadge tone="warning">
            <ShieldCheckIcon className="w-7 h-7" />
          </AuthBadge>
        }
      >
        <div className="space-y-6">
          <AuthAlert tone="warning">
            <div className="flex">
              <AlertTriangleIcon className="flex-shrink-0 w-5 h-5 text-brand-orange" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-heading">Security Policy Requirement</h3>
                <p className="mt-1 text-sm text-content">
                  Your organization requires MFA to be enabled. You cannot log in until you set up MFA.
                </p>
              </div>
            </div>
          </AuthAlert>

          <button onClick={onBack} className={authStyles.button}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Login
          </button>

          <p className="text-sm text-center text-muted">
            Contact your administrator if you need help setting up MFA.
          </p>
        </div>
      </AuthLayout>
    );
  }

  const toggleBase = 'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors';
  const toggleOn = 'bg-action text-on-action';
  const toggleOff = 'text-content hover:bg-surface';

  return (
    <AuthLayout
      title="Two-Factor Authentication"
      subtitle={
        <>
          Enter the verification code from your authenticator app
          <br />
          Logging in as <span className="font-medium text-heading">{user.email}</span>
        </>
      }
      icon={
        <AuthBadge>
          <ShieldCheckIcon className="w-7 h-7" />
        </AuthBadge>
      }
    >
      <form className="space-y-6" onSubmit={handleVerify}>
        <div className="space-y-4">
          {/* Toggle between MFA and Recovery Code */}
          <div className="flex p-1 border rounded-xl border-line bg-surface-2">
            <button
              type="button"
              onClick={() => setUseRecoveryCode(false)}
              className={`${toggleBase} ${!useRecoveryCode ? toggleOn : toggleOff}`}
            >
              Authenticator App
            </button>
            <button
              type="button"
              onClick={() => setUseRecoveryCode(true)}
              className={`${toggleBase} ${useRecoveryCode ? toggleOn : toggleOff}`}
            >
              <KeyIcon className="inline w-4 h-4 mr-1" />
              Recovery Code
            </button>
          </div>

          {!useRecoveryCode ? (
            <>
              {/* Authenticator Selection */}
              {factors.length > 1 && (
                <div>
                  <label htmlFor="factor" className={authStyles.label}>
                    Select Authenticator
                  </label>
                  <select
                    id="factor"
                    value={selectedFactor}
                    onChange={(e) => setSelectedFactor(e.target.value)}
                    className={`${authStyles.input} mt-1 px-4`}
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
                <label htmlFor="mfaCode" className={authStyles.label}>
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
                  className={`${authStyles.input} mt-1 px-4 text-2xl tracking-widest text-center`}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            </>
          ) : (
            /* Recovery Code Input */
            <div>
              <label htmlFor="recoveryCode" className={authStyles.label}>
                Recovery Code
              </label>
              <input
                id="recoveryCode"
                name="recoveryCode"
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH-IJKL"
                className={`${authStyles.input} mt-1 px-4 text-lg font-mono tracking-wider text-center`}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted">
                Enter one of your recovery codes (each can only be used once)
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && <AuthAlert>{error}</AuthAlert>}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isVerifying}
            className={authStyles.buttonOutline}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </button>

          <button
            type="submit"
            disabled={isVerifying || (!useRecoveryCode && mfaCode.length !== 6) || (useRecoveryCode && !recoveryCode.trim())}
            className={authStyles.button}
          >
            {isVerifying ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 rounded-full animate-spin border-on-action/40 border-t-on-action"></div>
                Verifying...
              </>
            ) : (
              useRecoveryCode ? 'Verify Recovery Code' : 'Verify & Login'
            )}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <p className="mt-6 text-xs text-center text-muted">
        Having trouble? Make sure your device's time is synchronized
      </p>
    </AuthLayout>
  );
};

export default MfaVerification;
