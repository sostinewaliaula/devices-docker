import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
// import { useSupabase } from '../../hooks/useSupabase'; // Removed - using new API
import { AlertCircleIcon, MonitorIcon, XCircleIcon, WifiIcon, WifiOffIcon, SearchIcon, FilterIcon, ArrowRightIcon, CheckCircleIcon, PaperclipIcon, FileIcon, XIcon } from 'lucide-react';
import { Asset, AssetRequestType } from '../../lib/supabase';
import { issueService, assetRequestsService, userService, notificationService, departmentService, auditService, assetService, assetRequestTypeService } from '../../services/apiDatabase';
import AssetImage from '../../components/AssetImage';
import useIssueCategories from '../../hooks/useIssueCategories';
import { formatKES } from '../../utils/formatCurrency';

const manufacturers = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Cisco', 'Logitech', 'Canon', 'Epson', 'LG', 'ASUS', 'Acer', 'Sony', 'Brother'];
const locations = ['Turnkey Africa', 'Branch Office - North', 'Branch Office - South', 'Branch Office - East', 'Branch Office - West', 'Data Center', 'Remote'];
const assetStatuses = ['Available', 'Assigned', 'In Maintenance', 'Reserved', 'Disposed'];
const assetConditions = ['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective'];

const UserAssets: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addNotification, addToast } = useNotifications();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  // Feature toggle state
  const [canSelfAddAsset, setCanSelfAddAsset] = useState<boolean>(false);
  // Add Asset form state
  const [showAddAssetForm, setShowAddAssetForm] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    type: 'Laptop',
    category: 'Electronics',
    manufacturer: 'Dell',
    model: '',
    serial_number: '',
    condition: 'New',
    location: 'Turnkey Africa',
    department_id: '',
    last_maintenance: null as string | null,
    notes: '',
    purchase_date: '',
    purchase_price: 0,
    current_value: 0,
    warranty_expiry: null as string | null
  });
  const [isSubmittingAsset, setIsSubmittingAsset] = useState(false);
  // Edit asset modal state
  const [showEditAssetForm, setShowEditAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);

  // Issue form state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    type: '',
    priority: 'Medium'
  });
  const issueFormRef = useRef<HTMLFormElement | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = attachments.length + newFiles.length;
      if (totalFiles > 5) {
        addToast({ title: 'Error', message: 'You can only upload up to 5 files.', type: 'error' });
        return;
      }
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Asset request form state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newAssetRequest, setNewAssetRequest] = useState({
    type: '',
    reason: '',
    urgency: 'Medium'
  });
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const { issueCategories, activeIssueCategories, loadingIssueCategories } = useIssueCategories();

  // Loading states
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  // Employee department id for default assignment
  const [employeeDeptId, setEmployeeDeptId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Employee department id (if exists)
    const loadEmployeeDept = async () => {
      try {
        const departments = await departmentService.getAll();
        const employeeDept = departments.find(dept =>
          dept.name.toLowerCase().includes('employee')
        );
        if (employeeDept?.id) setEmployeeDeptId(employeeDept.id);
      } catch {
        // ignore
      }
    };
    loadEmployeeDept();
  }, []);

  useEffect(() => {
    // Fetch assets from API
    const fetchAssets = async () => {
      try {
        // Check if user is authenticated
        if (!user?.id) {
          setAssets([]);
          setFilteredAssets([]);
          setLoading(false);
          return;
        }

        // Fetch assets from API
        const assetsData = await assetService.getAll();
        const userAssets = assetsData.filter(asset => asset.assigned_to === user.id);

        setAssets(userAssets);
        setFilteredAssets(userAssets);
      } catch (error) {
        addNotification({
          title: 'Error',
          message: 'Failed to load assets',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, [addNotification, user?.id]);

  useEffect(() => {
    // Set default feature toggle (can be made configurable later)
    setCanSelfAddAsset(true);
  }, []);

  useEffect(() => {
    const loadAssetTypes = async () => {
      try {
        setLoadingAssetTypes(true);
        const data = await assetRequestTypeService.getAll();
        setAssetRequestTypes(data);
      } catch (error: any) {
        console.error('Failed to load asset request types:', error);
        addToast({
          title: 'Error',
          message: error?.response?.data?.error || 'Failed to load asset types. Please try again.',
          type: 'error'
        });
      } finally {
        setLoadingAssetTypes(false);
      }
    };
    loadAssetTypes();
  }, [addToast]);

  const activeAssetRequestTypes = useMemo(
    () => assetRequestTypes.filter(type => type.is_active),
    [assetRequestTypes]
  );

  useEffect(() => {
    if (!newIssue.type && activeIssueCategories.length > 0) {
      setNewIssue(prev => ({ ...prev, type: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, newIssue.type]);

  // Handle issue form submission
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset || !user) return;

    // Frontend validation
    if (newIssue.title.trim().length < 5) {
      addToast({
        title: 'Validation Error',
        message: 'Issue title must be at least 5 characters long',
        type: 'error',
        duration: 5000
      });
      return;
    }

    if (newIssue.description.trim().length < 10) {
      addToast({
        title: 'Validation Error',
        message: 'Issue description must be at least 10 characters long',
        type: 'error',
        duration: 5000
      });
      return;
    }

    if (!newIssue.type) {
      addToast({
        title: 'Validation Error',
        message: 'Please select an issue category',
        type: 'error',
        duration: 5000
      });
      return;
    }

    setIsSubmittingIssue(true);

    try {
      // Store values before resetting state for the toast message
      const issueTitle = newIssue.title;
      const assetName = selectedAsset?.name || 'your device';

      // Submit to API using FormData for attachments
      const formData = new FormData();
      formData.append('title', newIssue.title);
      formData.append('description', newIssue.description);
      formData.append('priority', newIssue.priority.toLowerCase());
      formData.append('category', newIssue.type);
      formData.append('asset_id', selectedAsset.id);
      if (selectedAsset.department_id) {
        formData.append('department_id', selectedAsset.department_id);
      }

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      await issueService.create(formData);

      // Backend automatically handles all notifications (in-app and email)
      // for the user, managers, and admins

      // Reset form and close modal
      setNewIssue({
        title: '',
        description: '',
        type: '',
        priority: 'Medium'
      });
      setAttachments([]);
      setShowIssueForm(false);
      setSelectedAsset(null);

      // Show success toast
      try {
        addToast({
          title: 'Issue Created',
          message: `Your issue "${issueTitle}" has been created successfully for ${assetName}.`,
          type: 'success',
          duration: 5000
        });
        // console.log('✅ Toast displayed successfully');
      } catch (toastError) {
        console.error('❌ Error showing toast:', toastError);
        // Still consider the operation successful since the issue was created
      }

      // Trigger notification refresh to immediately show the new notification
      // console.log('🔔 Triggering notification refresh...');
      window.dispatchEvent(new Event('refreshNotifications'));
    } catch (error: any) {
      console.error('Failed to create issue:', error);
      console.error('Error details:', error.response?.data || error.message);

      const errorMessage = error.response?.data?.message || error.message || 'Failed to report issue. Please try again.';

      addToast({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Open issue form for a specific asset
  const openIssueForm = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowIssueForm(true);
  };

  // Handle asset request form submission
  const handleAssetRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAssetRequest.type || !newAssetRequest.urgency || !newAssetRequest.reason) {
      addNotification({
        title: 'Error',
        message: 'Please fill in all required fields.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Please fill in all required fields.',
        type: 'error'
      });
      return;
    }

    if (newAssetRequest.reason.trim().length < 10) {
      addNotification({
        title: 'Error',
        message: 'Please provide a more detailed reason (at least 10 characters).',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Please provide a more detailed reason (at least 10 characters).',
        type: 'error'
      });
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const response = await assetRequestsService.create({
        user_id: user.id,
        asset_name: `Request for ${newAssetRequest.type}`,
        asset_type: newAssetRequest.type,
        category: 'Electronics', // Default category
        reason: newAssetRequest.reason,
        priority: newAssetRequest.urgency.toLowerCase(),
        notes: null
      });

      // Backend handles notifications automatically, so we just show success message
      addNotification({
        title: 'Request Submitted',
        message: 'Your request for a new device has been submitted successfully',
        type: 'success'
      });
      addToast({
        title: 'Request Submitted',
        message: 'Your request for a new device has been submitted successfully',
        type: 'success'
      });

      // Refresh notifications to show the new ones from backend
      setTimeout(() => {
        // Trigger a notification refresh by dispatching a custom event
        window.dispatchEvent(new CustomEvent('refreshNotifications'));
      }, 1000);

      setNewAssetRequest({
        type: '',
        reason: '',
        urgency: 'Medium'
      });
      setShowRequestForm(false);
    } catch (error) {
      addNotification({
        title: 'Error',
        message: 'Failed to submit device request. Please try again.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Failed to submit device request. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Add Asset submit handler
  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newAsset.name || !newAsset.type || !newAsset.serial_number) {
      addNotification({ title: 'Error', message: 'Please fill in all required fields.', type: 'error' });
      return;
    }
    setIsSubmittingAsset(true);
    try {
      const assetToAdd = {
        ...newAsset,
        assigned_to: user.id,
        department_id: employeeDeptId || null,
        status: 'Assigned' // Will be overridden by service, but required for type
      };
      await assetService.create(assetToAdd);
      addNotification({ title: 'Device Added', message: 'Your device has been added.', type: 'success' });
      addToast({ title: 'Device Added', message: `${newAsset.name} has been added and assigned to you.`, type: 'success' });
      try {
        await notificationService.create({
          user_id: user.id,
          title: 'Device Added',
          message: `Your device "${newAsset.name}" has been added and assigned to you.`,
          type: 'success',
          read: false
        });
        const recipients = await userService.getByRoles(['admin', 'department_officer']);
        await Promise.all(
          recipients
            .filter(u => u.id !== user.id)
            .map(u => notificationService.notifyUser(
              u.id,
              'User Added Own Asset',
              `${user.name} added an asset they own: "${newAsset.name}" (SN: ${newAsset.serial_number || 'N/A'}).`,
              'info'
            ))
        );
      } catch { }
      setShowAddAssetForm(false);
      setNewAsset({
        name: '',
        type: 'Laptop',
        category: 'Electronics',
        manufacturer: 'Dell',
        model: '',
        serial_number: '',
        condition: 'New',
        location: 'Turnkey Africa',
        department_id: '',
        last_maintenance: null,
        notes: '',
        purchase_date: '',
        purchase_price: 0,
        current_value: 0,
        warranty_expiry: null
      });
      // Refresh assets
      const assetsData = await assetService.getAll();
      const userAssets = assetsData.filter(asset => asset.assigned_to === user.id);
      setAssets(userAssets);
      setFilteredAssets(userAssets);
    } catch (error) {
      addNotification({ title: 'Error', message: 'Failed to add asset.', type: 'error' });
    } finally {
      setIsSubmittingAsset(false);
    }
  };

  const handleEditAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingAsset) return;
    // Only allow editing of specific fields
    const updates: any = {
      name: editingAsset.name,
      type: editingAsset.type,
      manufacturer: editingAsset.manufacturer,
      model: editingAsset.model || '',
      serial_number: editingAsset.serial_number,
      category: editingAsset.category,
      location: editingAsset.location,
      condition: editingAsset.condition,
      notes: editingAsset.notes || '',
      updated_at: new Date().toISOString()
    };
    try {
      await assetService.update(editingAsset.id, updates);
      try { await auditService.write({ user_id: user.id, action: 'asset.update_user', entity_type: 'asset', entity_id: editingAsset.id, details: { updates } }); } catch { }
      addNotification({ title: 'Asset Updated', message: 'Your asset details have been updated.', type: 'success' });
      addToast({ title: 'Asset Updated', message: `${editingAsset.name} has been updated.`, type: 'success' });
      try {
        await notificationService.create({
          user_id: user.id,
          title: 'Asset Updated',
          message: `Your asset "${editingAsset.name}" was updated successfully.`,
          type: 'success',
          read: false
        });
      } catch { }
      // Refresh list
      const assetsData = await assetService.getAll();
      const userAssets = assetsData.filter(asset => asset.assigned_to === user.id);
      setAssets(userAssets);
      setFilteredAssets(userAssets);
      setShowEditAssetForm(false);
      setEditingAsset(null);
    } catch (err) {
      addNotification({ title: 'Error', message: 'Failed to update asset.', type: 'error' });
    }
  };

  useEffect(() => {
    // Filter assets based on search term and filters
    let result = assets;
    if (searchTerm) {
      result = result.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterType !== 'All') {
      result = result.filter(asset => asset.type === filterType);
    }
    if (filterStatus !== 'All') {
      result = result.filter(asset => asset.status === filterStatus);
    }
    setFilteredAssets(result);
  }, [assets, searchTerm, filterType, filterStatus]);
  const safeAssetTypes = useMemo(() => {
    const uniqueTypes = Array.from(new Set(assets.map(asset => asset.type).filter(Boolean))) as string[];
    return ['All', ...uniqueTypes];
  }, [assets]);

  const safeAssetStatuses = useMemo(() => ['All', ...assetStatuses], []);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
      case 'Assigned':
        return 'bg-lightred text-primary';
      case 'In Maintenance':
      case 'Reserved':
        return 'bg-yellow-100 text-yellow-800';
      case 'Disposed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading assets...</p>
      </div>
    </div>;
  }

  // Check if user is not authenticated
  if (!user) {
    return <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center">
        <AlertCircleIcon className="w-16 h-16 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-700">Authentication Required</h3>
        <p className="mt-2 text-sm text-gray-500">Please log in to view your assets</p>
        <Link to="/login" className="px-4 py-2 mt-4 text-sm font-medium text-white bg-primary rounded-full shadow-button hover:opacity-90">
          Go to Login
        </Link>
      </div>
    </div>;
  }
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h1 className="text-3xl font-bold text-primary">My Devices</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">View and manage your assigned devices, {user.name}.</p>
      </div>
      {/* Quick Actions */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link to="/user/issues" className="button-primary flex items-center justify-center"> <AlertCircleIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">View My Issues</span> </Link>
          <button
            onClick={() => setShowRequestForm(true)}
            className="button-primary flex items-center justify-center"
          >
            <MonitorIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Request New Device</span>
          </button>
          <Link to="/" className="button-primary flex items-center justify-center"> <ArrowRightIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Back to Dashboard</span> </Link>
        </div>
        {/* User self-add disabled: Only admins can add assets */}
      </div>
      {/* Add Asset modal removed for users */}
      {/* Search and Filter */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Search by name, serial number, or type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400" />
              </div>
              <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterType} onChange={e => setFilterType(e.target.value)}>
                {safeAssetTypes.map(type => <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option>)}
              </select>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400" />
              </div>
              <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                {safeAssetStatuses.map(status => <option key={status} value={status}>{status === 'All' ? 'All Statuses' : status}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      {/* Assets List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">{user.name}'s Assigned Assets</h2>
            <span className="px-3 py-1 text-sm font-medium text-primary bg-lightred rounded-full">{filteredAssets.length} assets</span>
          </div>
        </div>
        {filteredAssets.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-lightred dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3">Asset</th>
                <th scope="col" className="px-6 py-3">Type</th>
                <th scope="col" className="px-6 py-3">Serial Number</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Location</th>
                <th scope="col" className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(asset => (
                <tr
                  key={asset.id}
                  className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-lightred/50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors"
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 mr-3 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 dark:border-gray-800">
                        <AssetImage asset={asset} assetType={assetRequestTypes.find(t => t.name === asset.type)} />
                      </div>
                      <span>{asset.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{asset.type}</td>
                  <td className="px-6 py-4">{asset.serial_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>{asset.status}</span>
                  </td>
                  <td className="px-6 py-4">{asset.location}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-2">
                      <Link to={`/assets/${asset.id}`} className="button-primary px-3 py-1 text-xs font-medium">View Details</Link>
                      {/* Edit disabled for users; admins manage assets */}
                      <button
                        onClick={() => openIssueForm(asset)}
                        className="button-primary flex items-center"
                      >
                        <AlertCircleIcon className="w-4 h-4 mr-2" /> Report Issue
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <div className="flex flex-col items-center justify-center py-12">
          {searchTerm || filterType !== 'All' || filterStatus !== 'All' ? <>
            <AlertCircleIcon className="w-16 h-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-700">No matching assets found</h3>
            <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            <button onClick={() => { setSearchTerm(''); setFilterType('All'); setFilterStatus('All'); }} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Clear Filters</button>
          </> : <>
            <CheckCircleIcon className="w-16 h-16 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-700">No assets assigned yet</h3>
            <p className="mt-2 text-sm text-gray-500">You don't have any assets assigned to you yet, {user.name}</p>
          </>}
        </div>}
      </div>

      {/* Issue Form Modal */}
      {showIssueForm && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-lightred dark:bg-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <AlertCircleIcon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary dark:text-white">
                  Report an Issue
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowIssueForm(false);
                  setSelectedAsset(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Connection Warning - Removed since we're using API instead of Supabase */}

            {/* Asset Info Section */}
            <div className="p-6 bg-lightred/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-gray-700 rounded-xl">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Asset:</span> {selectedAsset.name}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-700 rounded-xl">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Type:</span> {selectedAsset.type}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="overflow-y-auto max-h-[60vh] p-6">
              <form ref={issueFormRef} onSubmit={handleIssueSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Issue Title *
                    </label>
                    <input
                      type="text"
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      placeholder="Brief description of the issue"
                      value={newIssue.title}
                      onChange={e => setNewIssue({
                        ...newIssue,
                        title: e.target.value
                      })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Issue Category
                    </label>
                    <select
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      value={newIssue.type}
                      onChange={e => setNewIssue({
                        ...newIssue,
                        type: e.target.value
                      })}
                      required
                      disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !newIssue.type)}
                    >
                      <option value="">
                        {loadingIssueCategories
                          ? 'Loading categories...'
                          : activeIssueCategories.length
                            ? 'Select Issue Category'
                            : 'No active categories available'}
                      </option>
                      {activeIssueCategories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                      {!loadingIssueCategories && newIssue.type && !issueCategories.some(category => category.name === newIssue.type) && (
                        <option value={newIssue.type}>{newIssue.type}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={newIssue.priority}
                    onChange={e => setNewIssue({
                      ...newIssue,
                      priority: e.target.value
                    })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description *
                  </label>
                  <textarea
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all resize-none"
                    rows={5}
                    placeholder="Detailed description of the issue..."
                    value={newIssue.description}
                    onChange={e => setNewIssue({
                      ...newIssue,
                      description: e.target.value
                    })}
                    required
                  />
                </div>

                {/* Attachments Section */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Attachments (Max 5)
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <PaperclipIcon className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, PDF (MAX. 10MB)
                        </p>
                      </div>
                      <input type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,.pdf" />
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <FileIcon className="w-5 h-5 flex-shrink-0 text-primary" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer inside form to enable native submit */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 -mx-6 px-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIssueForm(false);
                      setSelectedAsset(null);
                    }}
                    className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingIssue}
                    className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] shadow-lg"
                  >
                    {isSubmittingIssue ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      'Submit Issue'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Asset Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-lightred dark:bg-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MonitorIcon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary dark:text-white">
                  Request New Asset
                </h3>
              </div>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="overflow-y-auto max-h-[60vh] p-6">
              <form onSubmit={handleAssetRequestSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Asset Type *
                    </label>
                    <select
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      value={newAssetRequest.type}
                      onChange={e => setNewAssetRequest({
                        ...newAssetRequest,
                        type: e.target.value
                      })}
                      required
                      disabled={loadingAssetTypes || (activeAssetRequestTypes.length === 0 && !newAssetRequest.type)}
                    >
                      <option value="">
                        {loadingAssetTypes
                          ? 'Loading asset types...'
                          : activeAssetRequestTypes.length
                            ? 'Select Asset Type'
                            : 'No active asset types available'}
                      </option>
                      {activeAssetRequestTypes.map((type) => (
                        <option key={type.id} value={type.name}>
                          {type.name}
                        </option>
                      ))}
                      {!loadingAssetTypes && newAssetRequest.type && !assetRequestTypes.some(type => type.name === newAssetRequest.type) && (
                        <option value={newAssetRequest.type}>{newAssetRequest.type}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Urgency Level
                    </label>
                    <select
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      value={newAssetRequest.urgency}
                      onChange={e => setNewAssetRequest({
                        ...newAssetRequest,
                        urgency: e.target.value
                      })}
                    >
                      <option value="Low">Low - Can wait a few weeks</option>
                      <option value="Medium">Medium - Needed within 1-2 weeks</option>
                      <option value="High">High - Needed within a few days</option>
                      <option value="Urgent">Urgent - Needed immediately</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reason for Request *
                  </label>
                  <textarea
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all resize-none"
                    rows={6}
                    placeholder="Please explain why you need this asset, how it will improve your work, and any specific requirements or preferences..."
                    value={newAssetRequest.reason}
                    onChange={e => setNewAssetRequest({
                      ...newAssetRequest,
                      reason: e.target.value
                    })}
                    required
                  />
                </div>

                {/* Additional Information Section */}
                <div className="p-4 bg-lightred/30 dark:bg-gray-800/50 rounded-xl border border-lightred/50 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    💡 Tips for a better request:
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Be specific about the asset type and specifications needed</li>
                    <li>• Explain how this asset will improve your productivity</li>
                    <li>• Mention any urgent deadlines or business impact</li>
                    <li>• Include any specific brand or model preferences</li>
                  </ul>
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleAssetRequestSubmit}
                disabled={isSubmittingRequest}
                className="px-6 py-3 text-sm font-medium text-white bg-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {isSubmittingRequest ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset modal removed for users */}
    </div>
  );
};
export default UserAssets;
