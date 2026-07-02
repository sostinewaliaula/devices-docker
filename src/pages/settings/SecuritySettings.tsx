import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';

const SecuritySettings: React.FC = () => {
  const { startEnrollTotp, verifyEnrollTotp, disableTotp, listMfaFactors } = useAuth();
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr?: string; uri?: string } | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'enrolling' | 'verifying' | 'enabled'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<Array<{ id: string; type: string; friendlyName?: string; status?: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await listMfaFactors();
        setFactors(list);
        if (list.find(f => f.type === 'totp' && f.status === 'verified')) setStatus('enabled');
      } catch {}
    })();
  }, [listMfaFactors]);

  const beginEnroll = async () => {
    setError(null);
    setStatus('enrolling');
    try {
      const res = await startEnrollTotp();
      setEnrollData({ factorId: res.factorId, qr: res.qrCode, uri: res.otpauthUrl });
    } catch (e: any) {
      // If a factor already exists, guide user to disable first
      const msg = String(e?.message || 'Failed to start enrollment');
      if (msg.toLowerCase().includes('already exists')) {
        setError('You already have a 2FA factor. If you are re-enrolling, please disable the existing factor first.');
      } else {
        setError(msg);
      }
      setStatus('idle');
    }
  };

  const verify = async () => {
    if (!enrollData) return;
    setError(null);
    setStatus('verifying');
    try {
      // Trim spaces and ensure only digits
      const cleaned = code.replace(/\s+/g, '');
      await verifyEnrollTotp({ factorId: enrollData.factorId, code: cleaned });
      // Refresh list after success
      setFactors(await listMfaFactors());
      setStatus('enabled');
    } catch (e: any) {
      const msg = String(e?.message || 'Verification failed');
      // Provide clearer guidance for challenge-related errors
      if (/challenge id/i.test(msg)) {
        setError('The enrollment session expired. Please click Enable 2FA again to start a new enrollment, rescan, and enter the fresh code.');
      } else {
        setError(msg);
      }
      setStatus('enrolling');
    }
  };

  const disable = async () => {
    const targetId = enrollData?.factorId || factors.find(f => f.type === 'totp')?.id;
    if (!targetId) { setError('No TOTP factor found to disable.'); return; }
    setError(null);
    try {
      await disableTotp(targetId);
      setEnrollData(null);
      setStatus('idle');
      setCode('');
      setFactors(await listMfaFactors());
    } catch (e: any) { setError(e?.message || 'Failed to disable'); }
  };

  const disableById = async (factorId: string) => {
    setError(null);
    try {
      await disableTotp(factorId);
      const updated = await listMfaFactors();
      setFactors(updated);
      if (!updated.find(f => f.type === 'totp' && f.status === 'verified')) setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Failed to disable factor');
    }
  };

  const disableAllTotp = async () => {
    setError(null);
    try {
      const current = await listMfaFactors();
      const totps = current.filter(f => f.type === 'totp');
      for (const f of totps) {
        await disableTotp(f.id);
      }
      const updated = await listMfaFactors();
      setFactors(updated);
      setStatus('idle');
      setEnrollData(null);
      setCode('');
    } catch (e: any) {
      setError(e?.message || 'Failed to disable all TOTP factors');
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card max-w-xl">
      <h1 className="text-2xl font-bold text-primary">Security</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Protect your account with 2-Step Verification (TOTP).</p>

      {!enrollData && status === 'idle' && (
        <button onClick={beginEnroll} className="mt-4 px-4 py-2 button-primary">Enable 2FA</button>
      )}

      {enrollData && (
        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Step 1: Scan QR Code</h2>
            {enrollData.qr ? (
              <img src={enrollData.qr} alt="TOTP QR" className="mt-3 w-56 h-56 bg-white p-2 rounded" />
            ) : (
              <div className="mt-3 text-sm text-gray-600 break-all">{enrollData.uri}</div>
            )}
            <p className="mt-2 text-sm text-gray-500">Use Google Authenticator, Microsoft Authenticator, or any TOTP app.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">Step 2: Enter 6-digit Code</h2>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" className="mt-2 block w-40 px-3 py-2 border rounded-xl" />
            <div className="mt-3 flex gap-2">
              <button onClick={verify} className="px-4 py-2 button-primary" disabled={!code || status==='verifying'}>
                {status==='verifying' ? 'Verifying…' : 'Verify & Activate'}
              </button>
              <button onClick={disable} className="px-4 py-2 border rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {status === 'enabled' && (
        <div className="mt-6 p-4 bg-lightred rounded-xl">
          <p className="text-primary">Two-factor authentication is enabled.</p>
          <button onClick={disable} className="mt-3 px-4 py-2 border rounded-xl">Disable 2FA</button>
        </div>
      )}

      {factors.length > 0 && (
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl">
          <h3 className="font-semibold text-primary mb-2">Your MFA Factors</h3>
          <div className="mb-3 flex gap-2">
            <button onClick={async ()=> setFactors(await listMfaFactors())} className="px-3 py-1 text-xs border rounded-xl">Refresh</button>
            <button onClick={disableAllTotp} className="px-3 py-1 text-xs border rounded-xl text-red-600">Disable All TOTP</button>
          </div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            {factors.map(f => (
              <li key={f.id} className="flex items-center justify-between">
                <span>{(f.friendlyName || f.type)} — {f.status || 'pending'}</span>
                {f.type === 'totp' && <button onClick={() => disableById(f.id)} className="text-red-600 text-xs">Disable</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
    </div>
  );
};

export default SecuritySettings;


