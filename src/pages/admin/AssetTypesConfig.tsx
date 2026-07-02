import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { assetTypeService, dropdownOptionsService } from '../../services/apiDatabase';
import { AssetType, DropdownOption } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { PlusIcon, TrashIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, SearchIcon, SettingsIcon, ListIcon, TagIcon, BoxIcon, InfoIcon, ShieldCheckIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';

const AssetTypesConfig: React.FC = () => {
  const { addToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'assetTypes' | 'dropdowns'>('assetTypes');
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Asset Type Modal State
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showTypeDeleteModal, setShowTypeDeleteModal] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<AssetType | null>(null);
  const [typeFormData, setTypeFormData] = useState({ name: '', description: '', is_active: true });
  const [parameters, setParameters] = useState<Array<{ name: string, type: string, required: boolean }>>([]);

  // Dropdown Option Modal State
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [showDropdownDeleteModal, setShowDropdownDeleteModal] = useState(false);
  const [editingDropdown, setEditingDropdown] = useState<DropdownOption | null>(null);
  const [dropdownToDelete, setDropdownToDelete] = useState<DropdownOption | null>(null);
  const [dropdownFormData, setDropdownFormData] = useState({ type: 'manufacturer', value: '', is_active: true });

  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return assetTypes;
    const term = searchTerm.toLowerCase();
    return assetTypes.filter(
      (type) =>
        type.name.toLowerCase().includes(term) ||
        (type.description?.toLowerCase().includes(term) ?? false)
    );
  }, [assetTypes, searchTerm]);

  const filteredDropdowns = useMemo(() => {
    if (!searchTerm.trim()) return dropdownOptions;
    const term = searchTerm.toLowerCase();
    return dropdownOptions.filter(
      (opt) =>
        opt.value.toLowerCase().includes(term) ||
        opt.type.toLowerCase().includes(term)
    );
  }, [dropdownOptions, searchTerm]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'assetTypes') {
        const data = await assetTypeService.getAll(true);
        setAssetTypes(data);
      } else {
        const data = await dropdownOptionsService.getAll(undefined, true);
        setDropdownOptions(data);
      }
    } catch (error) {
      console.error('Failed to load configuration data:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load configuration data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Asset Type Actions
  const handleOpenTypeModal = (type?: AssetType) => {
    if (type) {
      setEditingType(type);
      setTypeFormData({
        name: type.name,
        description: type.description || '',
        is_active: type.is_active
      });
      setParameters(type.parameters_schema || []);
    } else {
      setEditingType(null);
      setTypeFormData({ name: '', description: '', is_active: true });
      setParameters([]);
    }
    setShowTypeModal(true);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeFormData.name.trim().length < 2) {
      addToast({ title: 'Validation', message: 'Name must be at least 2 characters', type: 'warning' });
      return;
    }
    if (parameters.some(p => !p.name.trim())) {
      addToast({ title: 'Validation', message: 'All parameter names must be filled out', type: 'warning' });
      return;
    }

    const payload = {
      ...typeFormData,
      parameters_schema: parameters
    };

    try {
      if (editingType) {
        await assetTypeService.update(editingType.id, payload);
        addToast({ title: 'Updated', message: 'Asset management type updated', type: 'success' });
      } else {
        await assetTypeService.create(payload as any);
        addToast({ title: 'Added', message: 'Asset management type added', type: 'success' });
      }
      setShowTypeModal(false);
      loadData();
    } catch (error: any) {
      addToast({ title: 'Error', message: error?.response?.data?.error || 'Failed to save asset type', type: 'error' });
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;
    try {
      await assetTypeService.delete(typeToDelete.id);
      addToast({ title: 'Deleted', message: 'Asset type deleted', type: 'success' });
      setShowTypeDeleteModal(false);
      loadData();
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to delete asset type', type: 'error' });
    }
  };

  const moveParameter = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= parameters.length) return;
    
    const newParams = [...parameters];
    [newParams[index], newParams[newIdx]] = [newParams[newIdx], newParams[index]];
    setParameters(newParams);
  };

  // Dropdown Option Actions
  const handleOpenDropdownModal = (opt?: DropdownOption, defaultType?: string) => {
    if (opt) {
      setEditingDropdown(opt);
      setDropdownFormData({
        type: opt.type,
        value: opt.value,
        is_active: opt.is_active
      });
    } else {
      setEditingDropdown(null);
      setDropdownFormData({ type: defaultType || 'manufacturer', value: '', is_active: true });
    }
    setShowDropdownModal(true);
  };

  const handleSaveDropdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropdownFormData.value.trim()) {
      addToast({ title: 'Validation', message: 'Value is required', type: 'warning' });
      return;
    }

    try {
      if (editingDropdown) {
        await dropdownOptionsService.update(editingDropdown.id, dropdownFormData);
        addToast({ title: 'Updated', message: 'Option updated successfully', type: 'success' });
      } else {
        await dropdownOptionsService.create(dropdownFormData);
        addToast({ title: 'Added', message: 'Option added successfully', type: 'success' });
      }
      setShowDropdownModal(false);
      loadData();
    } catch (error: any) {
      addToast({ title: 'Error', message: error?.response?.data?.error || 'Failed to save option', type: 'error' });
    }
  };

  const handleDeleteDropdown = async () => {
    if (!dropdownToDelete) return;
    try {
      await dropdownOptionsService.delete(dropdownToDelete.id);
      addToast({ title: 'Deleted', message: 'Option deleted', type: 'success' });
      setShowDropdownDeleteModal(false);
      loadData();
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to delete option', type: 'error' });
    }
  };

  const renderAssetTypesTab = () => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Asset type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Parameters</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTypes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No asset types found.
                </td>
              </tr>
            ) : filteredTypes.map((type) => (
              <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <ListIcon className="w-4 h-4 mr-2 text-primary" />
                  {type.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{type.description || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex flex-wrap gap-1">
                    {(type.parameters_schema || []).map((p, i) => (
                      <span key={i} className="inline-block bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5 text-xs">
                        {p.name} ({p.type})
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${type.is_active ? 'bg-lightred text-primary' : 'bg-red-100 text-red-700'}`}>
                    {type.is_active ? <CheckCircleIcon className="w-3 h-3 mr-1" /> : <XCircleIcon className="w-3 h-3 mr-1" />}
                    {type.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => handleOpenTypeModal(type)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setTypeToDelete(type); setShowTypeDeleteModal(true); }} className="text-red-600 hover:text-red-800">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDropdownsTab = () => {
    const types = ['manufacturer', 'category', 'status', 'condition'];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {types.map((type) => {
          const typeOptions = filteredDropdowns.filter(o => o.type === type);
          const icon = type === 'manufacturer' ? <BoxIcon className="w-5 h-5" /> : 
                       type === 'category' ? <TagIcon className="w-5 h-5" /> :
                       type === 'status' ? <ShieldCheckIcon className="w-5 h-5" /> : 
                       <InfoIcon className="w-5 h-5" />;
          
          return (
            <div key={type} className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center text-primary font-bold capitalize">
                  {icon}
                  <span className="ml-2">{type}s</span>
                </div>
                <button
                  onClick={() => handleOpenDropdownModal(undefined, type)}
                  className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-primary"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-64">
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {typeOptions.length === 0 ? (
                      <tr><td className="p-4 text-center text-sm text-gray-500 italic">No {type}s defined</td></tr>
                    ) : typeOptions.map((opt) => (
                      <tr key={opt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {opt.value}
                          {!opt.is_active && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1 rounded">Inactive</span>}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button onClick={() => handleOpenDropdownModal(opt)} className="text-blue-500 hover:text-blue-700"><SettingsIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setDropdownToDelete(opt); setShowDropdownDeleteModal(true); }} className="text-red-500 hover:text-red-700"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && assetTypes.length === 0 && dropdownOptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCwIcon className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Asset Configuration</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Manage dynamic asset types, custom fields, and dropdown options.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-72">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-primary"
            />
          </div>
          <button onClick={loadData} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center text-sm">
            <RefreshCwIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {activeTab === 'assetTypes' && (
            <button onClick={() => handleOpenTypeModal()} className="button-primary flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" /> Add Asset Type
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('assetTypes')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'assetTypes' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Asset Management Types
        </button>
        <button
          onClick={() => setActiveTab('dropdowns')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'dropdowns' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Global Dropdown Options
        </button>
      </div>

      {activeTab === 'assetTypes' ? renderAssetTypesTab() : renderDropdownsTab()}

      {/* Modal for Asset Type */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">{editingType ? 'Edit Asset Type' : 'Add Asset Type'}</h2>
              <button onClick={() => setShowTypeModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSaveType} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type Name</label>
                  <input
                    type="text"
                    value={typeFormData.name}
                    onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary"
                    placeholder="E.g. Laptop"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={typeFormData.description}
                    onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-primary"
                    rows={2}
                  />
                </div>
              </div>

               {/* Parameters Builder */}
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300">Custom Attributes</h3>
                  <button type="button" onClick={() => setParameters([...parameters, { name: '', type: 'text', required: false }])} className="text-sm text-primary flex items-center underline">
                    <PlusIcon className="w-4 h-4 mr-1" /> Add Field
                  </button>
                </div>
                <div className="space-y-3">
                  {parameters.map((param, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveParameter(idx, 'up')}
                          disabled={idx === 0}
                          className={`p-0.5 rounded ${idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                          title="Move up"
                        >
                          <ChevronUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveParameter(idx, 'down')}
                          disabled={idx === parameters.length - 1}
                          className={`p-0.5 rounded ${idx === parameters.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                          title="Move down"
                        >
                          <ChevronDownIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        placeholder="Field Name"
                        value={param.name}
                        onChange={(e) => {
                          const newParams = [...parameters];
                          newParams[idx].name = e.target.value;
                          setParameters(newParams);
                        }}
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                        required
                      />
                      <select
                        value={param.type}
                        onChange={(e) => {
                          const newParams = [...parameters];
                          newParams[idx].type = e.target.value;
                          setParameters(newParams);
                        }}
                        className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                        <option value="dropdown">Dropdown (Custom)</option>
                        <option value="global_dropdown">Dropdown (Global)</option>
                      </select>
                      {param.type === 'dropdown' && (
                        <input
                          placeholder="Options (8GB, 16GB...)"
                          value={(param as any).options || ''}
                          onChange={(e) => {
                            const newParams = [...parameters];
                            (newParams[idx] as any).options = e.target.value;
                            setParameters(newParams);
                          }}
                          className="w-40 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                          required
                        />
                      )}
                      {param.type === 'global_dropdown' && (
                        <select
                          value={(param as any).source || 'manufacturer'}
                          onChange={(e) => {
                            const newParams = [...parameters];
                            (newParams[idx] as any).source = e.target.value;
                            setParameters(newParams);
                          }}
                          className="w-40 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                        >
                          <option value="manufacturer">Manufacturer</option>
                          <option value="category">Category</option>
                          <option value="status">Status</option>
                          <option value="condition">Condition</option>
                        </select>
                      )}
                      <button type="button" onClick={() => {
                        const newParams = [...parameters];
                        newParams.splice(idx, 1);
                        setParameters(newParams);
                      }} className="text-red-500">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={typeFormData.is_active}
                    onChange={(e) => setTypeFormData({ ...typeFormData, is_active: e.target.checked })}
                    className="mr-2 text-primary focus:ring-primary rounded"
                  />
                  Active
                </label>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl">Cancel</button>
                  <button type="submit" className="button-primary">{editingType ? 'Update' : 'Create'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Dropdown Option */}
      {showDropdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <h2 className="text-xl font-bold text-primary mb-4">{editingDropdown ? 'Edit Option' : 'Add Option'}</h2>
            <form onSubmit={handleSaveDropdown} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Option Type</label>
                <select
                  value={dropdownFormData.type}
                  onChange={(e) => setDropdownFormData({ ...dropdownFormData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-primary"
                >
                  <option value="manufacturer">Manufacturer</option>
                  <option value="category">Category</option>
                  <option value="status">Status</option>
                  <option value="condition">Condition</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
                <input
                  type="text"
                  value={dropdownFormData.value}
                  onChange={(e) => setDropdownFormData({ ...dropdownFormData, value: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-primary"
                  placeholder="E.g. Apple, Available, Good..."
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={dropdownFormData.is_active}
                  onChange={(e) => setDropdownFormData({ ...dropdownFormData, is_active: e.target.checked })}
                  className="mr-2 text-primary focus:ring-primary rounded"
                />
                <label className="text-sm">Active</label>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setShowDropdownModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" className="button-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modals... */}
      {showTypeDeleteModal && typeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete Asset Type</h2>
            <p>Delete <strong>{typeToDelete.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowTypeDeleteModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl">Cancel</button>
              <button onClick={handleDeleteType} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showDropdownDeleteModal && dropdownToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-red-600 mb-4">Delete Option</h2>
            <p>Delete <strong>{dropdownToDelete.value}</strong> from {dropdownToDelete.type}s?</p>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowDropdownDeleteModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl">Cancel</button>
              <button onClick={handleDeleteDropdown} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetTypesConfig;
