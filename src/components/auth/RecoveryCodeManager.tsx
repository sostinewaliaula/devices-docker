import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  ShieldCheckIcon, 
  CopyIcon, 
  DownloadIcon, 
  RefreshCwIcon, 
  EyeIcon, 
  EyeOffIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from 'lucide-react';

interface RecoveryCodeManagerProps {
  onClose: () => void;
}

const RecoveryCodeManager: React.FC<RecoveryCodeManagerProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Generate recovery codes when component mounts
  useEffect(() => {
    generateRecoveryCodes();
  }, []);

  const generateRecoveryCodes = async () => {
    if (!user?.id) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/mfa/recovery-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ count: 10 })
      });

      if (!response.ok) {
        throw new Error('Failed to generate recovery codes');
      }

      const data = await response.json();
      setRecoveryCodes(data.recoveryCodes);
      addToast('Recovery codes generated successfully', 'success');
    } catch (error) {
      console.error('Error generating recovery codes:', error);
      addToast('Failed to generate recovery codes', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      addToast('Code copied to clipboard', 'success');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      addToast('Failed to copy code', 'error');
    }
  };

  const downloadCodes = () => {
    const content = `Assets Management - Recovery Codes
Generated: ${new Date().toLocaleString()}
User: ${user?.email}

IMPORTANT: Store these codes in a safe place. Each code can only be used once.

${recoveryCodes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

Security Notice:
- Each recovery code can only be used once
- Store these codes in a secure location
- Do not share these codes with anyone
- If you lose these codes, you may need to contact support to regain access`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${user?.email}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast('Recovery codes downloaded', 'success');
  };

  const regenerateCodes = async () => {
    if (window.confirm('This will invalidate all existing recovery codes. Are you sure?')) {
      await generateRecoveryCodes();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Recovery Codes
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Backup codes for account recovery
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Security Notice */}
          <div className="bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Important Security Information
                </h3>
                <ul className="text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Each recovery code can only be used once</li>
                  <li>• Store these codes in a secure location (password manager, safe, etc.)</li>
                  <li>• Do not share these codes with anyone</li>
                  <li>• If you lose these codes, contact support to regain access</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Recovery Codes */}
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <RefreshCwIcon className="w-5 h-5 animate-spin text-indigo-600" />
                <span className="text-gray-600 dark:text-gray-400">Generating recovery codes...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Your Recovery Codes
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCodes(!showCodes)}
                    className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {showCodes ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    {showCodes ? 'Hide' : 'Show'} Codes
                  </button>
                  <button
                    onClick={regenerateCodes}
                    className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <RefreshCwIcon className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recoveryCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                        {index + 1}.
                      </span>
                      <code className="font-mono text-lg font-medium text-gray-900 dark:text-white">
                        {showCodes ? code : '••••••••'}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(code, index)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === index ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <CopyIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={downloadCodes}
              disabled={recoveryCodes.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              Download Codes
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryCodeManager;
