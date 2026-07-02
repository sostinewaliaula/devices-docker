import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationPreferences from '../../components/ui/NotificationPreferences';
import SystemSettingsSection from '../../components/settings/SystemSettingsSection';
import RecoveryCodeManager from '../../components/auth/RecoveryCodeManager';
import { KeyIcon } from 'lucide-react';

const Settings: React.FC = () => {
  const { user, startEnrollTotp, verifyEnrollTotp, disableTotp, listMfaFactors } = useAuth();
  const { addToast } = useNotifications();

  // 2FA state
  const [mfaStatus, setMfaStatus] = useState<'idle' | 'enrolling' | 'verifying' | 'enabled'>('idle');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [factors, setFactors] = useState<Array<{ id: string; type: string; friendlyName?: string; status?: string }>>([]);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr?: string; uri?: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [disablingFactor, setDisablingFactor] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState<string | null>(null);
  const [showDisableAllConfirm, setShowDisableAllConfirm] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);



  // Load factors
  React.useEffect(() => {
    (async () => {
      try {
        const list = await listMfaFactors();
        setFactors(list);
        if (list.some(f => f.type === 'totp' && f.status === 'verified')) setMfaStatus('enabled');
      } catch { }
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
      await verifyEnrollTotp(enrollData.factorId, cleaned);
      setFactors(await listMfaFactors());
      setMfaStatus('enabled');
    } catch (e: any) {
      const msg = String(e?.message || 'Verification failed');
      if (/challenge id/i.test(msg)) {
        setMfaError('The enrollment session expired. Click Enable 2FA to start again, rescan, and enter a fresh code.');
      } else {
        setMfaError(msg);
      }
      setMfaStatus('enrolling');
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
      addToast({ title: 'Success', message: 'MFA factor disabled successfully', type: 'success' });
      setShowDisableConfirm(null);
    } catch (e: any) {
      setMfaError(e?.message || 'Failed to disable factor');
      addToast({ title: 'Error', message: 'Failed to disable MFA factor', type: 'error' });
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
      addToast({ title: 'Success', message: 'All MFA factors disabled successfully', type: 'success' });
    } catch (e: any) {
      setMfaError(e?.message || 'Failed to disable all TOTP factors');
      addToast({ title: 'Error', message: 'Failed to disable all MFA factors', type: 'error' });
    }
  };

  const confirmDisableAll = () => {
    setShowDisableAllConfirm(true);
  };

  const cancelDisableAll = () => {
    setShowDisableAllConfirm(false);
  };

  const handleShowRecoveryCodes = () => {
    setShowRecoveryCodes(true);
  };

  const handleCloseRecoveryCodes = () => {
    setShowRecoveryCodes(false);
  };



  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600 dark:text-gray-400">
          Please log in to access settings.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your account preferences and notification settings.
        </p>
      </div>

      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Two-Factor Authentication (inline) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Two-Factor Authentication</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Protect your account with TOTP (Google/Microsoft Authenticator).</p>
        {mfaStatus === 'idle' && (
          <div className="flex items-center gap-2">
            <button onClick={beginEnroll} className="button-primary px-4 py-2 text-sm font-medium">Enable 2FA</button>
            {factors.length > 0 && (
              <button
                onClick={confirmDisableAll}
                className="px-4 py-2 text-sm font-medium border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
              >
                Disable All TOTP
              </button>
            )}
          </div>
        )}
        {enrollData && (
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="font-semibold text-primary">Step 1: Scan QR Code</h3>
              {enrollData.qr ? (
                <img src={enrollData.qr} alt="TOTP QR" className="mt-2 w-56 h-56 bg-white p-2 rounded" />
              ) : (
                <div className="mt-2 text-sm text-gray-600 break-all">{enrollData.uri}</div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-primary">Step 2: Enter 6-digit Code</h3>
              <input value={mfaCode} onChange={e => setMfaCode(e.target.value)} placeholder="123456" className="mt-2 block w-40 px-3 py-2 border rounded-xl" />
              <div className="mt-2 flex gap-2">
                <button onClick={verifyMfaEnroll} className="button-primary px-4 py-2 text-sm" disabled={!mfaCode || mfaStatus === 'verifying'}>
                  {mfaStatus === 'verifying' ? 'Verifying…' : 'Verify & Activate'}
                </button>
                <button onClick={disableAllTotp} className="px-4 py-2 text-sm border rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        )}
        {mfaStatus === 'enabled' && (
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-lightred rounded-xl text-primary">Two-factor authentication is enabled.</div>
            <button
              onClick={handleShowRecoveryCodes}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <KeyIcon className="w-4 h-4" />
              Manage Recovery Codes
            </button>
          </div>
        )}
        {factors.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-semibold text-primary">Your MFA Factors</h3>
              <button onClick={async () => setFactors(await listMfaFactors())} className="px-3 py-1 text-xs border rounded-xl">Refresh</button>
            </div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              {factors.map(f => (
                <li key={f.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="font-medium">{(f.friendlyName || f.type)}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${f.status === 'verified'
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
        {mfaError && <div className="mt-3 text-sm text-red-600">{mfaError}</div>}

        {/* Disable All Confirmation Dialog */}
        {showDisableAllConfirm && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Disable All MFA Factors?</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  This will disable all your MFA factors and remove two-factor authentication from your account.
                  You'll need to set up MFA again to re-enable it.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={disableAllTotp}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Yes, Disable All
                  </button>
                  <button
                    onClick={cancelDisableAll}
                    className="px-3 py-1 text-sm border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recovery Code Manager Modal */}
      {showRecoveryCodes && (
        <RecoveryCodeManager onClose={handleCloseRecoveryCodes} />
      )}



      {/* Additional Settings Sections */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Account Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <p className="text-gray-900 dark:text-white">{user.name || 'Not set'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <p className="text-gray-900 dark:text-white">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <p className="text-gray-900 dark:text-white capitalize">{user.role || 'User'}</p>
          </div>
        </div>
      </div>

      {/* More settings can be added here */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User ID
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{user.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Updated
            </label>
            <p className="text-gray-900 dark:text-white">
              {user.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* System Settings Section (Admin Only) */}
      {user.role === 'admin' && (
        <SystemSettingsSection />
      )}
    </div>
  );
};

export default Settings;


