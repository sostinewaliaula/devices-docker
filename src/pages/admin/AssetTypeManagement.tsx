import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { assetRequestTypeService } from '../../services/apiDatabase';
import { AssetRequestType } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { PlusIcon, EditIcon, TrashIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, SearchIcon, ImageIcon } from 'lucide-react';
import AssetImage from '../../components/AssetImage';

const AssetTypeManagement: React.FC = () => {
  const { addToast } = useNotifications();
  const [assetTypes, setAssetTypes] = useState<AssetRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingType, setEditingType] = useState<AssetRequestType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<AssetRequestType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return assetTypes;
    const term = searchTerm.toLowerCase();
    return assetTypes.filter(
      (type) =>
        type.name.toLowerCase().includes(term) ||
        (type.description?.toLowerCase().includes(term) ?? false)
    );
  }, [assetTypes, searchTerm]);

  const loadAssetTypes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await assetRequestTypeService.getAll(true);
      setAssetTypes(data);
    } catch (error) {
      console.error('Failed to load asset request types:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load asset request types',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadAssetTypes();
  }, [loadAssetTypes]);

  const handleOpenModal = (type?: AssetRequestType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        is_active: type.is_active
      });
    } else {
      setEditingType(null);
      setFormData({ name: '', description: '', is_active: true });
    }
    setSelectedFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim().length < 2) {
      addToast({ title: 'Validation', message: 'Name must be at least 2 characters', type: 'warning' });
      return;
    }

    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description);
    data.append('is_active', formData.is_active ? '1' : '0');
    if (selectedFile) {
      data.append('image', selectedFile);
    }

    try {
      if (editingType) {
        await assetRequestTypeService.update(editingType.id, data);
        addToast({ title: 'Updated', message: 'Asset type updated successfully', type: 'success' });
      } else {
        await assetRequestTypeService.create(data);
        addToast({ title: 'Added', message: 'Asset type added successfully', type: 'success' });
      }
      setShowModal(false);
      setEditingType(null);
      setFormData({ name: '', description: '', is_active: true });
      loadAssetTypes();
    } catch (error: any) {
      console.error('Save asset request type error:', error);
      addToast({
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to save asset type',
        type: 'error'
      });
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await assetRequestTypeService.delete(typeToDelete.id);
      addToast({ title: 'Deleted', message: 'Asset type deleted', type: 'success' });
      setShowDeleteModal(false);
      setTypeToDelete(null);
      loadAssetTypes();
    } catch (error) {
      console.error('Delete asset request type error:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete asset type',
        type: 'error'
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <RefreshCwIcon className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading asset types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Asset Request Types</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Keep the asset request form in sync with approved asset categories.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-72">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search asset types…"
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={loadAssetTypes}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center text-sm text-gray-700 dark:text-gray-200"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="button-primary flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-2" /> Add Asset Type
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Image</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Asset Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                    {searchTerm.trim()
                      ? 'No asset types match your search.'
                      : 'No asset types found. Click "Add Asset Type" to create one.'}
                  </td>
                </tr>
              ) : filteredTypes.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50">
                      <AssetImage assetType={type} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{type.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {type.description || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {type.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-lightred text-primary">
                        <CheckCircleIcon className="w-3 h-3 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        <XCircleIcon className="w-3 h-3 mr-1" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => handleOpenModal(type)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                    >
                      <EditIcon className="w-4 h-4 mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setTypeToDelete(type);
                        setShowDeleteModal(true);
                      }}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                    >
                      <TrashIcon className="w-4 h-4 mr-1" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">{editingType ? 'Edit Asset Type' : 'Add Asset Type'}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  placeholder="Enter asset type name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary focus:border-primary"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type Image</label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : editingType ? (
                      <AssetImage assetType={editingType} />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Max size 5MB. Recommended: Square image.</p>
              </div>

              <div className="flex items-center">
                <input
                  id="asset-type-active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="asset-type-active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Active
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary">
                  {editingType ? 'Update Asset Type' : 'Add Asset Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && typeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <h2 className="text-xl font-bold text-primary mb-4">Delete Asset Type</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{typeToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTypeToDelete(null);
                }}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetTypeManagement;

