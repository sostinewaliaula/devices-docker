import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { ShieldCheckIcon, ArrowLeftIcon, KeyIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, CopyIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MfaSetup: React.FC = () => {
  const { user, startEnrollTotp, verifyEnrollTotp, disableTotp, listMfaFactors } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const [mfaStatus, setMfaStatus] = useState<'idle' | 'enrolling' | 'verifying' | 'enabled'>('idle');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [factors, setFactors] = useState<Array<{ id: string; type: string; friendlyName?: string; status?: string }>>([]);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr?: string; uri?: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disablingFactor, setDisablingFactor] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState<string | null>(null);
  const [showDisableAllConfirm, setShowDisableAllConfirm] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await listMfaFactors();
        setFactors(list);
        if (list.some(f => f.type === 'totp' && f.status === 'verified')) {
          setMfaStatus('enabled');
        }
      } catch (error) {
        console.error('Error loading MFA factors:', error);
      }
    })();
  }, [listMfaFactors]);

  const beginEnroll = async () => {
    setMfaError(null);
    setMfaStatus('enrolling');
    try {
      const res = await startEnrollTotp();
      setEnrollData({ factorId: res.factorId, qr: res.qrCode, uri: res.otpauthUrl });
    } catch (e: any) {
      const msg = String(e?.message || 'Failed to start enrollment');
      if (msg.toLowerCase().includes('already exists')) {
        setMfaError('You already have a 2FA factor. Disable the existing factor first.');
      } else {
        setMfaError(msg);
      }
      setMfaStatus('idle');
    }
  };

  const verifyMfaEnroll = async () => {
    if (!enrollData) return;
    setMfaError(null);
    setMfaStatus('verifying');
    try {
      const cleaned = mfaCode.replace(/\s+/g, '');
      const result = await verifyEnrollTotp(enrollData.factorId, cleaned);
      setRecoveryCodes(result.recoveryCodes);
      setFactors(await listMfaFactors());
      setMfaStatus('enabled');
      addToast('MFA enabled successfully! You can now log in normally.', 'success');
      setShowRecoveryCodes(true);
    } catch (e: any) {
      const msg = String(e?.message || 'Verification failed');
      if (/challenge id/i.test(msg)) {
        setMfaError('The enrollment session expired. Click Enable 2FA to start again, rescan, and enter a fresh code.');
      } else {
        setMfaError(msg);
      }
      setMfaStatus('enrolling');
      addToast('Failed to verify MFA. Please try again.', 'error');
    }
  };

  const disableById = async (factorId: string) => {
    setMfaError(null);
    setDisablingFactor(factorId);
    try {
      await disableTotp(factorId);
      const updated = await listMfaFactors();
      setFactors(updated);
      if (!updated.some(f => f.type === 'totp' && f.status === 'verified')) setMfaStatus('idle');
      addToast('MFA factor disabled successfully', 'success');
      setShowDisableConfirm(null);
    } catch (e: any) {
      setMfaError(e?.message || 'Failed to disable factor');
      addToast('Failed to disable MFA factor', 'error');
    } finally {
      setDisablingFactor(null);
    }
  };

  const confirmDisable = (factorId: string) => {
    setShowDisableConfirm(factorId);
  };

  const cancelDisable = () => {
    setShowDisableConfirm(null);
  };

  const disableAllTotp = async () => {
    setMfaError(null);
    setShowDisableAllConfirm(false);
    try {
      const current = await listMfaFactors();
      const totps = current.filter(f => f.type === 'totp');
      for (const f of totps) {
        await disableTotp(f.id);
      }
      const updated = await listMfaFactors();
      setFactors(updated);
      setMfaStatus('idle');
      setEnrollData(null);
      setMfaCode('');
      addToast('All MFA factors disabled successfully', 'success');
    } catch (e: any) {
      setMfaError(e?.message || 'Failed to disable all TOTP factors');
      addToast('Failed to disable all MFA factors', 'error');
    }
  };

  const confirmDisableAll = () => {
    setShowDisableAllConfirm(true);
  };

  const cancelDisableAll = () => {
    setShowDisableAllConfirm(false);
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  const handleContinueToApp = () => {
    navigate('/user/dashboard');
  };

  const handleShowRecoveryCodes = () => {
    setShowRecoveryCodes(true);
  };

  const handleCloseRecoveryCodes = () => {
    setShowRecoveryCodes(false);
  };

  const copyRecoveryCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      addToast('Recovery code copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy code:', error);
      addToast('Failed to copy code', 'error');
    }
  };

  const copyAllRecoveryCodes = async () => {
    try {
      const allCodes = recoveryCodes.join('\n');
      await navigator.clipboard.writeText(allCodes);
      addToast('All recovery codes copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy all codes:', error);
      addToast('Failed to copy all codes', 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-indigo-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            MFA Setup Required
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your organization requires Multi-Factor Authentication (MFA) for security.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Setting up for <span className="font-medium">{user?.email}</span>
          </p>
        </div>

        {/* Security Policy Warning */}
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
                  You must enable MFA to access your account. This is required by your organization's security policy.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* MFA Setup Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
          
          {mfaStatus === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Protect your account with TOTP (Google/Microsoft Authenticator).
              </p>
              <button 
                onClick={beginEnroll} 
                className="w-full button-primary px-4 py-2 text-sm font-medium"
              >
                Enable 2FA
              </button>
            </div>
          )}

          {enrollData && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-primary mb-2">Step 1: Scan QR Code</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Use your authenticator app to scan this QR code:
                </p>
                {enrollData.qr ? (
                  <div className="flex justify-center">
                    <img src={enrollData.qr} alt="TOTP QR" className="w-48 h-48 bg-white p-2 rounded" />
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400 break-all bg-gray-100 dark:bg-gray-700 p-3 rounded">
                    {enrollData.uri}
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="font-semibold text-primary mb-2">Step 2: Enter 6-digit Code</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Enter the 6-digit code from your authenticator app:
                </p>
                <input 
                  value={mfaCode} 
                  onChange={e => setMfaCode(e.target.value)} 
                  placeholder="123456" 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-center text-lg tracking-widest"
                  maxLength={6}
                />
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={verifyMfaEnroll} 
                    disabled={!mfaCode || mfaStatus === 'verifying'}
                    className="flex-1 button-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mfaStatus === 'verifying' ? 'Verifying...' : 'Verify & Activate'}
                  </button>
                  <button 
                    onClick={() => setEnrollData(null)} 
                    className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {mfaStatus === 'enabled' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Two-factor authentication is enabled!
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleShowRecoveryCodes}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <KeyIcon className="w-4 h-4" />
                  View Recovery Codes
                </button>
                
                <button 
                  onClick={handleContinueToApp}
                  className="w-full button-primary px-4 py-2 text-sm font-medium"
                >
                  Continue to Application
                </button>
              </div>
            </div>
          )}

          {factors.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-primary">Your MFA Factors</h4>
                <button 
                  onClick={async () => setFactors(await listMfaFactors())} 
                  className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Refresh
                </button>
              </div>
              <ul className="space-y-2">
                {factors.map(f => (
                  <li key={f.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium text-sm">{(f.friendlyName || f.type)}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        f.status === 'verified' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {f.status || 'pending'}
                      </span>
                    </div>
                    {f.type === 'totp' && (
                      <div className="flex items-center gap-2">
                        {showDisableConfirm === f.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Are you sure?</span>
                            <button 
                              onClick={() => disableById(f.id)}
                              disabled={disablingFactor === f.id}
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {disablingFactor === f.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Disabling...
                                </>
                              ) : (
                                'Yes, Disable'
                              )}
                            </button>
                            <button 
                              onClick={cancelDisable}
                              disabled={disablingFactor === f.id}
                              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => confirmDisable(f.id)}
                            disabled={disablingFactor === f.id}
                            className="px-3 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-md transition-colors disabled:opacity-50"
                          >
                            Disable
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mfaError && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{mfaError}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleBackToLogin}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Login
          </button>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Contact your administrator if you need help setting up MFA.
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Codes Modal */}
      {showRecoveryCodes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recovery Codes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md mb-4">
              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                    <span className="text-gray-900 dark:text-gray-100 font-semibold tracking-wider">
                      {code}
                    </span>
                    <button
                      onClick={() => copyRecoveryCode(code)}
                      className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      title="Copy code"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyAllRecoveryCodes}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Copy All
              </button>
              <button
                onClick={handleCloseRecoveryCodes}
                className="flex-1 button-primary px-4 py-2 text-sm"
              >
                I've Saved These Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MfaSetup;
