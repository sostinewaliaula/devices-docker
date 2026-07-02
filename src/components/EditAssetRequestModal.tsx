import React, { useState, useEffect, useMemo } from 'react';
import { AssetRequest, AssetRequestType } from '../lib/supabase';
import { XCircleIcon, SaveIcon, AlertCircleIcon } from 'lucide-react';
import { assetRequestTypeService } from '../services/apiDatabase';

interface EditAssetRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: AssetRequest | null;
  onSave: (updatedRequest: Partial<AssetRequest>) => Promise<void>;
}

const EditAssetRequestModal: React.FC<EditAssetRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  onSave
}) => {
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_type: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const [assetTypeError, setAssetTypeError] = useState('');
  const activeAssetTypes = useMemo(
    () => assetRequestTypes.filter((type) => type.is_active),
    [assetRequestTypes]
  );

  useEffect(() => {
    if (request) {
      setFormData({
        asset_name: request.asset_name || '',
        asset_type: request.asset_type || '',
        reason: request.reason || ''
      });
    }
  }, [request]);

  useEffect(() => {
    const loadAssetTypes = async () => {
      try {
        setLoadingAssetTypes(true);
        const data = await assetRequestTypeService.getAll();
        setAssetRequestTypes(data);
        setAssetTypeError('');
      } catch (err: any) {
        console.error('Failed to load asset request types:', err);
        setAssetTypeError(err?.response?.data?.error || 'Failed to load asset types');
      } finally {
        setLoadingAssetTypes(false);
      }
    };
    loadAssetTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Edit Asset Request
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center space-x-2">
              <AlertCircleIcon className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400 text-sm">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="asset_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asset Name *
            </label>
            <input
              type="text"
              id="asset_name"
              name="asset_name"
              value={formData.asset_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Enter asset name"
            />
          </div>

          <div>
            <label htmlFor="asset_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Asset Type *
            </label>
            <select
              id="asset_type"
              name="asset_type"
              value={formData.asset_type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              disabled={loadingAssetTypes || (activeAssetTypes.length === 0 && !formData.asset_type)}
            >
              <option value="">
                {loadingAssetTypes
                  ? 'Loading asset types...'
                  : activeAssetTypes.length
                    ? 'Select asset type'
                    : 'No active asset types available'}
              </option>
              {activeAssetTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
              {!loadingAssetTypes && formData.asset_type && !assetRequestTypes.some(type => type.name === formData.asset_type) && (
                <option value={formData.asset_type}>{formData.asset_type}</option>
              )}
            </select>
            {assetTypeError && (
              <p className="mt-2 text-xs text-red-500">{assetTypeError}</p>
            )}
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Request *
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Explain why you need this asset"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAssetRequestModal;
