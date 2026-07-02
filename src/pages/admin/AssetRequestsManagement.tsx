import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { assetRequestsService, assetRequestTypeService } from '../../services/apiDatabase';
import api from '../../services/apiService';
import AssetImage from '../../components/AssetImage';
import { AssetRequest } from '../../lib/supabase';
import CommentsSection from '../../components/CommentsSection';
import {
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  RefreshCwIcon,
  CheckIcon,
  XIcon,
  PackageIcon,
  UserIcon,
  MessageCircleIcon,
  DollarSignIcon
} from 'lucide-react';

interface AssetRequestWithUser extends AssetRequest {
  user_name?: string;
  user_email?: string;
  approved_by_name?: string;
}

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'KES';

const AssetRequestsManagement: React.FC = () => {
  const { addToast } = useNotifications();
  const [assetRequests, setAssetRequests] = useState<AssetRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AssetRequestWithUser | null>(null);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    priority: '',
    notes: '',
    estimated_cost: ''
  });
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'fulfill' | 'delete';
    requestId?: string;
    requestIds?: string[];
    message: string;
  } | null>(null);

  const [costSummary, setCostSummary] = useState<{ total_estimated_cost: number; currency: string }>({
    total_estimated_cost: 0,
    currency: DEFAULT_CURRENCY
  });

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: costSummary.currency || DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    } catch {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    }
  }, [costSummary.currency]);

  const formatCurrency = useCallback((value?: number | null) => {
    if (value === null || value === undefined) {
      return 'Not set';
    }
    return currencyFormatter.format(value);
  }, [currencyFormatter]);

  useEffect(() => {
    fetchAssetRequests();
  }, []);

  const fetchAssetRequests = async () => {
    try {
      setLoading(true);
      const [response, typesData] = await Promise.all([
        api.get('/asset-requests', { params: { includeCostSummary: true } }),
        assetRequestTypeService.getAll()
      ]);

      const requests = (response.data?.asset_requests || []) as AssetRequestWithUser[];
      const normalizedRequests = requests.map(request => ({
        ...request,
        estimated_cost: request.estimated_cost === null || request.estimated_cost === undefined
          ? null
          : Number(request.estimated_cost)
      }));
      setAssetRequests(normalizedRequests);
      setAssetRequestTypes(typesData || []);
      const summary = response.data?.cost_summary;
      setCostSummary(summary ? {
        total_estimated_cost: Number(summary.total_estimated_cost ?? 0),
        currency: summary.currency || DEFAULT_CURRENCY
      } : {
        total_estimated_cost: 0,
        currency: DEFAULT_CURRENCY
      });
    } catch (error) {
      console.error('Error fetching asset requests:', error);
      addToast({
        title: 'Error',
        message: 'Failed to fetch asset requests',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequest = async () => {
    if (!selectedRequest) return;

    try {
      await assetRequestsService.update(selectedRequest.id, {
        status: updateData.status || selectedRequest.status,
        priority: updateData.priority || selectedRequest.priority,
        notes: updateData.notes || selectedRequest.notes,
        estimated_cost: updateData.estimated_cost === ''
          ? selectedRequest.estimated_cost ?? null
          : Number(updateData.estimated_cost)
      });

      addToast({
        title: 'Success',
        message: 'Asset request updated successfully',
        type: 'success'
      });

      setShowUpdateModal(false);
      setSelectedRequest(null);
      setUpdateData({ status: '', priority: '', notes: '', estimated_cost: '' });
      fetchAssetRequests();
    } catch (error) {
      console.error('Error updating asset request:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update asset request',
        type: 'error'
      });
    }
  };

  const handleQuickAction = (action: 'approve' | 'reject' | 'fulfill', requestId: string) => {
    const request = assetRequests.find(r => r.id === requestId);
    if (!request) return;

    setConfirmAction({
      type: action,
      requestId,
      message: `Are you sure you want to ${action} the request for "${request.asset_name}"?`
    });
    setShowConfirmModal(true);
  };

  const handleBulkAction = (action: 'approve' | 'reject' | 'fulfill') => {
    if (selectedRequests.length === 0) return;

    setConfirmAction({
      type: action,
      requestIds: selectedRequests,
      message: `Are you sure you want to ${action} ${selectedRequests.length} selected request(s)?`
    });
    setShowConfirmModal(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    try {
      if (confirmAction.type === 'delete') {
        // Handle delete action
        if (confirmAction.requestId) {
          await assetRequestsService.delete(confirmAction.requestId.toString());
        } else if (confirmAction.requestIds) {
          await Promise.all(
            confirmAction.requestIds.map(id => assetRequestsService.delete(id.toString()))
          );
        }
        addToast({
          title: 'Success',
          message: 'Request(s) deleted successfully',
          type: 'success'
        });
      } else {
        // Handle other actions (approve, reject, fulfill)
        if (confirmAction.requestId) {
          // Single request action
          await assetRequestsService.update(confirmAction.requestId, {
            status: confirmAction.type === 'approve' ? 'approved' :
              confirmAction.type === 'reject' ? 'rejected' : 'fulfilled'
          });
        } else if (confirmAction.requestIds) {
          // Bulk action
          await Promise.all(
            confirmAction.requestIds.map(id =>
              assetRequestsService.update(id, {
                status: confirmAction.type === 'approve' ? 'approved' :
                  confirmAction.type === 'reject' ? 'rejected' : 'fulfilled'
              })
            )
          );
        }
        addToast({
          title: 'Success',
          message: `Request(s) ${confirmAction.type}d successfully`,
          type: 'success'
        });
      }

      setShowConfirmModal(false);
      setConfirmAction(null);
      setSelectedRequests([]);
      fetchAssetRequests();
    } catch (error) {
      console.error('Error executing action:', error);
      addToast({
        title: 'Error',
        message: `Failed to ${confirmAction.type} request(s)`,
        type: 'error'
      });
    }
  };

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequests(prev =>
      prev.includes(requestId)
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map(r => r.id));
    }
  };

  const handleDeleteRequest = (requestId: string) => {
    const request = assetRequests.find(req => req.id.toString() === requestId);
    if (request) {
      setConfirmAction({
        type: 'delete',
        message: `Are you sure you want to delete the request for "${request.asset_name}"? This action cannot be undone.`,
        requestId: requestId
      });
      setShowConfirmModal(true);
    }
  };

  const openDetailsModal = (request: AssetRequestWithUser) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const openUpdateModal = (request: AssetRequestWithUser) => {
    setSelectedRequest(request);
    setUpdateData({
      status: request.status,
      priority: request.priority,
      notes: request.notes || '',
      estimated_cost: request.estimated_cost !== null && request.estimated_cost !== undefined
        ? request.estimated_cost.toString()
        : ''
    });
    setShowUpdateModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'fulfilled':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      case 'pending':
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700';
      case 'low':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700';
      case 'fulfilled':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700';
      case 'pending':
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700';
    }
  };

  const filteredRequests = assetRequests.filter(request => {
    const matchesSearch =
      request.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || request.status === statusFilter;
    const matchesPriority = !priorityFilter || request.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <RefreshCwIcon className="w-8 h-8 animate-spin text-primary" />
          <p className="mt-4 text-gray-600">Loading asset requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">Asset Requests Management</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">
          Manage and review all asset requests from users
        </p>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedRequests.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedRequests.length} request(s) selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="px-3 py-1 bg-green-500 dark:bg-green-600 text-white text-sm rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors flex items-center"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Approve All
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="px-3 py-1 bg-red-500 dark:bg-red-600 text-white text-sm rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition-colors flex items-center"
                >
                  <XIcon className="w-4 h-4 mr-1" />
                  Reject All
                </button>
                <button
                  onClick={() => handleBulkAction('fulfill')}
                  className="px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center"
                >
                  <PackageIcon className="w-4 h-4 mr-1" />
                  Fulfill All
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedRequests([])}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="fulfilled">Fulfilled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <button
            onClick={fetchAssetRequests}
            className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <ClockIcon className="w-8 h-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {assetRequests.filter(r => r.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {assetRequests.filter(r => r.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <XCircleIcon className="w-8 h-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {assetRequests.filter(r => r.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <PackageIcon className="w-8 h-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Fulfilled</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {assetRequests.filter(r => r.status === 'fulfilled').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <AlertCircleIcon className="w-8 h-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {assetRequests.length}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <DollarSignIcon className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Estimated Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(costSummary.total_estimated_cost)}
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{costSummary.currency}</span>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">All Asset Requests</h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">{filteredRequests.length} request(s)</span>
          </div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            💡 <strong>Tip:</strong> Click on any row to view request details
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-white dark:bg-gray-700"
                  />
                </th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">ASSET</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">USER</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">PRIORITY</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">EST. COST</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">STATUS</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">REQUESTED</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${selectedRequests.includes(request.id) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-900'}`}
                  onClick={() => openDetailsModal(request)}
                >
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedRequests.includes(request.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRequest(request.id);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-white dark:bg-gray-700"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                        <AssetImage
                          assetType={assetRequestTypes.find(t => t.name === request.asset_type)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{request.asset_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{request.asset_type} • {request.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mr-2">
                        <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{request.user_name || 'Unknown User'}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{request.user_email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {request.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-900 dark:text-gray-100">
                    {formatCurrency(request.estimated_cost)}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {new Date(request.requested_date).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      {/* View Details Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailsModal(request);
                        }}
                        className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openUpdateModal(request);
                        }}
                        className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        title="Edit Request"
                      >
                        <EditIcon className="w-5 h-5" />
                      </button>

                      {/* Quick Action Buttons */}
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction('approve', request.id);
                            }}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Approve Request"
                          >
                            <CheckIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction('reject', request.id);
                            }}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Reject Request"
                          >
                            <XIcon className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction('fulfill', request.id);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Mark as Fulfilled"
                        >
                          <PackageIcon className="w-5 h-5" />
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(request.id.toString());
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Request"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <AlertCircleIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No asset requests found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary">Request Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name</label>
                <p className="text-gray-900 dark:text-gray-100">{selectedRequest.asset_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <p className="text-gray-900 dark:text-gray-100">{selectedRequest.asset_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <p className="text-gray-900 dark:text-gray-100">{selectedRequest.category}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested By</label>
                <p className="text-gray-900 dark:text-gray-100">{selectedRequest.user_name || 'Unknown User'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedRequest.user_email || ''}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <p className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{selectedRequest.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedRequest.priority)}`}>
                    {selectedRequest.priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <div className="flex items-center">
                    {getStatusIcon(selectedRequest.status)}
                    <span className={`ml-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                      {selectedRequest.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Cost</label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(selectedRequest.estimated_cost)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested Date</label>
                  <p className="text-gray-900 dark:text-gray-100">{new Date(selectedRequest.requested_date).toLocaleDateString()}</p>
                </div>
                {selectedRequest.approved_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approved Date</label>
                    <p className="text-gray-900 dark:text-gray-100">{new Date(selectedRequest.approved_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {selectedRequest.approved_by_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approved By</label>
                  <p className="text-gray-900 dark:text-gray-100">{selectedRequest.approved_by_name}</p>
                </div>
              )}

              {selectedRequest.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <p className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">{selectedRequest.notes}</p>
                </div>
              )}

              {/* Comments Section */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <CommentsSection
                  assetRequestId={selectedRequest.id}
                  currentUserId={1} // TODO: Get from auth context
                  isAdmin={true}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  openUpdateModal(selectedRequest);
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Update Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary">Update Request</h2>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="fulfilled">Fulfilled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={updateData.priority}
                  onChange={(e) => setUpdateData({ ...updateData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  placeholder="Add notes about this request..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Cost</label>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500 dark:text-gray-400">{costSummary.currency}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={updateData.estimated_cost}
                    onChange={(e) => setUpdateData({ ...updateData, estimated_cost: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Enter estimated cost"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRequest}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Update Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary">Confirm Action</h2>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-start space-x-4 mb-6">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${confirmAction.type === 'approve'
                ? 'bg-green-100 dark:bg-green-900/30'
                : confirmAction.type === 'reject'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : confirmAction.type === 'delete'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                {confirmAction.type === 'approve' ? (
                  <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : confirmAction.type === 'reject' ? (
                  <XIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                ) : confirmAction.type === 'delete' ? (
                  <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                ) : (
                  <PackageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 text-lg font-medium mb-2">
                  {confirmAction.type === 'delete' ? 'Delete Request' :
                    confirmAction.type === 'approve' ? 'Approve Request' :
                      confirmAction.type === 'reject' ? 'Reject Request' : 'Fulfill Request'}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {confirmAction.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmAction.type === 'approve'
                  ? 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700'
                  : confirmAction.type === 'reject'
                    ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700'
                    : confirmAction.type === 'delete'
                      ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700'
                      : 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700'
                  }`}
              >
                {confirmAction.type === 'approve' ? 'Approve' :
                  confirmAction.type === 'reject' ? 'Reject' :
                    confirmAction.type === 'delete' ? 'Delete' : 'Fulfill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRequestsManagement;
