import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { assetRequestsService, assetRequestTypeService } from '../../services/apiDatabase';
import { AssetRequest, AssetRequestType } from '../../lib/supabase';
import AssetImage from '../../components/AssetImage';
import CommentsSection from '../../components/CommentsSection';
import EditAssetRequestModal from '../../components/EditAssetRequestModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  MessageCircleIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  EditIcon,
  TrashIcon
} from 'lucide-react';

const UserAssetRequests: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AssetRequest | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<AssetRequest | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchAssetRequests();
  }, []);

  const fetchAssetRequests = async () => {
    try {
      setLoading(true);
      const [requests, types] = await Promise.all([
        assetRequestsService.getByUserId(user?.id || ''),
        assetRequestTypeService.getAll()
      ]);
      setAssetRequests(requests);
      setAssetRequestTypes(types || []);

      if (requests.length === 0) {
        addToast({
          title: 'No Requests Found',
          message: 'You haven\'t submitted any asset requests yet',
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Error fetching asset requests:', error);
      addToast({
        title: 'Error',
        message: 'Failed to fetch asset requests. Please try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'fulfilled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewComments = (request: AssetRequest) => {
    setSelectedRequest(request);
    setShowComments(true);
    addToast({
      title: 'Comments Opened',
      message: `Viewing comments for "${request.asset_name}"`,
      type: 'info'
    });
  };

  const handleCloseComments = () => {
    setSelectedRequest(null);
    setShowComments(false);
  };

  const handleEditRequest = (request: AssetRequest) => {
    setEditingRequest(request);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setEditingRequest(null);
    setShowEditModal(false);
  };

  const handleSaveRequest = async (updatedData: Partial<AssetRequest>) => {
    if (!editingRequest) return;

    try {
      const updatedRequest = await assetRequestsService.updateUser(editingRequest.id, updatedData);

      // Update the local state
      setAssetRequests(prev =>
        prev.map(req => req.id === editingRequest.id ? { ...req, ...updatedRequest } : req)
      );

      addToast({
        title: 'Request Updated',
        message: 'Your asset request has been updated successfully',
        type: 'success'
      });

      handleCloseEditModal();
    } catch (error: any) {
      throw error; // Re-throw to be handled by the modal
    }
  };

  const handleDeleteRequest = (request: AssetRequest) => {
    setDeleteRequest(request);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteRequest(null);
    setShowDeleteModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRequest) return;

    try {
      await assetRequestsService.deleteUser(deleteRequest.id);

      // Remove from local state
      setAssetRequests(prev => prev.filter(req => req.id !== deleteRequest.id));

      addToast({
        title: 'Request Deleted',
        message: 'Your asset request has been deleted successfully',
        type: 'success'
      });

      handleCloseDeleteModal();
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete request',
        type: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              My Asset Requests
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track the status of your asset requests and communicate with administrators
            </p>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {assetRequests.length} request{assetRequests.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Asset Requests List */}
      <div className="space-y-4">
        {assetRequests.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-8 text-center">
            <AlertCircleIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Asset Requests
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You haven't submitted any asset requests yet.
            </p>
          </div>
        ) : (
          assetRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      <AssetImage
                        assetType={assetRequestTypes.find(t => t.name === request.asset_type)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {getStatusIcon(request.status)}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {request.asset_name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <TagIcon className="w-4 h-4" />
                      <span>{request.asset_type}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      <span>Requested: {formatDate(request.requested_date)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Reason for Request:
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      {request.reason}
                    </p>
                  </div>

                  {request.notes && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Admin Notes:
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        {request.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleViewComments(request)}
                      className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      <MessageCircleIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">View Comments</span>
                    </button>

                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleEditRequest(request)}
                          className="flex items-center space-x-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                        >
                          <EditIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(request)}
                          className="flex items-center space-x-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comments Modal */}
      {showComments && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Comments for {selectedRequest.asset_name}
                </h2>
                <button
                  onClick={handleCloseComments}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <CommentsSection
                assetRequestId={selectedRequest.id}
                currentUserId={user?.id || '0'}
                isAdmin={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditAssetRequestModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        request={editingRequest}
        onSave={handleSaveRequest}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Asset Request"
        message={`Are you sure you want to delete your request for "${deleteRequest?.asset_name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default UserAssetRequests;
