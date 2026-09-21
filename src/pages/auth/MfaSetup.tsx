import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { ShieldCheckIcon, ArrowLeftIcon, KeyIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, CopyIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthLayout, { AuthAlert, AuthBadge, authStyles } from '../../components/auth/AuthLayout';

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

  const smallOutline =
    'px-3 py-1.5 text-xs font-medium border border-line text-heading bg-surface rounded-lg hover:border-primary hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <>
      <AuthLayout
        title="MFA Setup Required"
        subtitle={
          <>
            Your organization requires Multi-Factor Authentication (MFA) for security.
            <br />
            Setting up for <span className="font-medium text-heading">{user?.email}</span>
          </>
        }
        icon={
          <AuthBadge>
            <ShieldCheckIcon className="w-7 h-7" />
          </AuthBadge>
        }
        footer="Contact your administrator if you need help setting up MFA."
      >
        <div className="space-y-6">
          {/* Security Policy Warning */}
          <AuthAlert tone="warning">
            <div className="flex">
              <AlertTriangleIcon className="flex-shrink-0 w-5 h-5 text-brand-orange" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-heading">Security Policy Requirement</h3>
                <p className="mt-1 text-sm text-content">
                  You must enable MFA to access your account. This is required by your organization's security policy.
                </p>
              </div>
            </div>
          </AuthAlert>

          {/* MFA Setup Section */}
          <div>
            <h3 className="mb-3 text-lg font-semibold text-heading">Two-Factor Authentication</h3>

            {mfaStatus === 'idle' && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Protect your account with TOTP (Google/Microsoft Authenticator).
                </p>
                <button onClick={beginEnroll} className={authStyles.button}>
                  Enable 2FA
                </button>
              </div>
            )}

            {enrollData && (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-semibold text-heading">Step 1: Scan QR Code</h4>
                  <p className="mb-3 text-sm text-muted">
                    Use your authenticator app to scan this QR code:
                  </p>
                  {enrollData.qr ? (
                    <div className="flex justify-center">
                      <img src={enrollData.qr} alt="TOTP QR" className="w-48 h-48 p-2 bg-white border rounded-xl border-line" />
                    </div>
                  ) : (
                    <div className="p-3 text-sm break-all border rounded-xl text-content bg-surface-2 border-line">
                      {enrollData.uri}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 font-semibold text-heading">Step 2: Enter 6-digit Code</h4>
                  <p className="mb-3 text-sm text-muted">
                    Enter the 6-digit code from your authenticator app:
                  </p>
                  <input
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                    placeholder="123456"
                    className={`${authStyles.input} px-4 text-lg tracking-widest text-center`}
                    maxLength={6}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={verifyMfaEnroll}
                      disabled={!mfaCode || mfaStatus === 'verifying'}
                      className={authStyles.button}
                    >
                      {mfaStatus === 'verifying' ? 'Verifying...' : 'Verify & Activate'}
                    </button>
                    <button
                      onClick={() => setEnrollData(null)}
                      className={authStyles.buttonOutline}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mfaStatus === 'enabled' && (
              <div className="space-y-4">
                <AuthAlert tone="success">
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">Two-factor authentication is enabled!</span>
                  </div>
                </AuthAlert>

                <div className="space-y-3">
                  <button onClick={handleShowRecoveryCodes} className={`${authStyles.buttonOutline} gap-2`}>
                    <KeyIcon className="w-4 h-4" />
                    View Recovery Codes
                  </button>

                  <button onClick={handleContinueToApp} className={authStyles.button}>
                    Continue to Application
                  </button>
                </div>
              </div>
            )}

            {factors.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-heading">Your MFA Factors</h4>
                  <button
                    onClick={async () => setFactors(await listMfaFactors())}
                    className={smallOutline}
                  >
                    Refresh
                  </button>
                </div>
                <ul className="space-y-2">
                  {factors.map(f => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-xl bg-surface-2 border-line">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${f.status === 'verified' ? 'bg-brand-green' : 'bg-brand-orange'}`}></div>
                        <span className="text-sm font-medium text-heading">{(f.friendlyName || f.type)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          f.status === 'verified'
                            ? 'bg-brand-green text-secondary'
                            : 'bg-brand-orange/20 text-content'
                        }`}>
                          {f.status || 'pending'}
                        </span>
                      </div>
                      {f.type === 'totp' && (
                        <div className="flex items-center gap-2">
                          {showDisableConfirm === f.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">Are you sure?</span>
                              <button
                                onClick={() => disableById(f.id)}
                                disabled={disablingFactor === f.id}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {disablingFactor === f.id ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                                    Disabling...
                                  </>
                                ) : (
                                  'Yes, Disable'
                                )}
                              </button>
                              <button
                                onClick={cancelDisable}
                                disabled={disablingFactor === f.id}
                                className={smallOutline}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => confirmDisable(f.id)}
                              disabled={disablingFactor === f.id}
                              className="px-3 py-1.5 text-xs font-medium transition-colors rounded-lg text-primary hover:bg-lightred disabled:opacity-50"
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

            {mfaError && <AuthAlert className="mt-4">{mfaError}</AuthAlert>}
          </div>

          {/* Action Buttons */}
          <button onClick={handleBackToLogin} className={`${authStyles.buttonOutline} gap-2`}>
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Login
          </button>
        </div>
      </AuthLayout>

      {/* Recovery Codes Modal */}
      {showRecoveryCodes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md p-6 mx-4 border bg-surface border-line rounded-2xl shadow-card">
            <h3 className="mb-4 text-lg font-semibold text-heading">
              Recovery Codes
            </h3>
            <p className="mb-4 text-sm text-muted">
              Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div className="p-4 mb-4 border rounded-xl bg-surface-2 border-line">
              <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2 border rounded-lg bg-surface border-line">
                    <span className="font-semibold tracking-wider text-heading">
                      {code}
                    </span>
                    <button
                      onClick={() => copyRecoveryCode(code)}
                      className="p-1 ml-2 transition-colors text-muted hover:text-primary"
                      title="Copy code"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={copyAllRecoveryCodes} className={authStyles.buttonOutline}>
                Copy All
              </button>
              <button onClick={handleCloseRecoveryCodes} className={authStyles.button}>
                I've Saved These Codes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MfaSetup;
