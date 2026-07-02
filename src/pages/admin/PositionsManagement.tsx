import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { positionService } from '../../services/apiDatabase';
import { Position } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { PlusIcon, EditIcon, TrashIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, SearchIcon } from 'lucide-react';

const PositionsManagement: React.FC = () => {
  const { addToast } = useNotifications();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPositions = useMemo(() => {
    if (!searchTerm.trim()) return positions;
    const term = searchTerm.toLowerCase();
    return positions.filter(
      (position) =>
        position.name.toLowerCase().includes(term) ||
        (position.description?.toLowerCase().includes(term) ?? false)
    );
  }, [positions, searchTerm]);

  const loadPositions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await positionService.getAll(true);
      setPositions(data);
    } catch (error) {
      console.error('Failed to load positions:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load positions',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const handleOpenModal = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setFormData({
        name: position.name,
        description: position.description || '',
        is_active: position.is_active
      });
    } else {
      setEditingPosition(null);
      setFormData({ name: '', description: '', is_active: true });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim().length < 2) {
      addToast({ title: 'Validation', message: 'Name must be at least 2 characters', type: 'warning' });
      return;
    }

    try {
      if (editingPosition) {
        await positionService.update(editingPosition.id, formData);
        addToast({ title: 'Updated', message: 'Position updated successfully', type: 'success' });
      } else {
        await positionService.create(formData);
        addToast({ title: 'Added', message: 'Position added successfully', type: 'success' });
      }
      setShowModal(false);
      setEditingPosition(null);
      setFormData({ name: '', description: '', is_active: true });
      loadPositions();
    } catch (error: any) {
      console.error('Save position error:', error);
      addToast({
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to save position',
        type: 'error'
      });
    }
  };

  const handleDelete = async () => {
    if (!positionToDelete) return;
    try {
      await positionService.delete(positionToDelete.id);
      addToast({ title: 'Deleted', message: 'Position deleted', type: 'success' });
      setShowDeleteModal(false);
      setPositionToDelete(null);
      loadPositions();
    } catch (error) {
      console.error('Delete position error:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete position',
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <RefreshCwIcon className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading positions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Positions</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Manage the list of available user positions.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-72">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search positions…"
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            />
          </div>
          <button
            onClick={loadPositions}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center text-sm text-gray-700 dark:text-gray-200"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="button-primary flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-2" /> Add Position
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPositions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {searchTerm.trim()
                    ? 'No positions match your search.'
                    : 'No positions found. Click "Add Position" to create one.'}
                </td>
              </tr>
            ) : filteredPositions.map((position) => (
                <tr key={position.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{position.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {position.description || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {position.is_active ? (
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
                      onClick={() => handleOpenModal(position)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center"
                    >
                      <EditIcon className="w-4 h-4 mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setPositionToDelete(position);
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
              <h2 className="text-xl font-bold text-primary">{editingPosition ? 'Edit Position' : 'Add Position'}</h2>
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
                  placeholder="Enter position name"
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
              <div className="flex items-center">
                <input
                  id="position-active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="position-active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
                  {editingPosition ? 'Update Position' : 'Add Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && positionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <h2 className="text-xl font-bold text-primary mb-4">Delete Position</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{positionToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPositionToDelete(null);
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

export default PositionsManagement;

