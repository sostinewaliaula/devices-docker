import React, { useEffect, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { issueService, assetService, userService, commentService, notificationService, departmentService, assetRequestTypeService } from '../../services/apiDatabase';
import AssetImage from '../../components/AssetImage';
import api from '../../services/apiService';
import {
  ArrowLeftIcon,
  AlertCircleIcon,
  ClockIcon,
  XCircleIcon,
  MessageCircleIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  EditIcon,
  TrashIcon,
  DollarSignIcon
} from 'lucide-react';
import AttachmentItem from '../../components/AttachmentItem';
import ImagePreviewModal from '../../components/ImagePreviewModal';
import { User, IssueComment, Department } from '../../lib/supabase';

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'KES';

const IssueDetail: React.FC = () => {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [issue, setIssue] = useState<any>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [assignToUserId, setAssignToUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingComment, setEditingComment] = useState<IssueComment | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [estimatedCostInput, setEstimatedCostInput] = useState('');
  const [isUpdatingEstimatedCost, setIsUpdatingEstimatedCost] = useState(false);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Check if user can manage this issue
  const isAdmin = user?.role === 'admin';
  const isItOfficer = user?.role === 'manager' && user?.department_id &&
    departments.find(d => d.id === user.department_id)?.name?.toLowerCase().includes('it');

  const canManageIssue = isAdmin || isItOfficer;

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    } catch {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2
      });
    }
  }, []);

  const formatCurrency = useCallback((value?: number | null) => {
    if (value === null || value === undefined) {
      return 'Not set';
    }
    return currencyFormatter.format(value);
  }, [currencyFormatter]);

  useEffect(() => {
    if (issueId) {
      fetchIssueDetails();
    }
  }, [issueId]);

  useLayoutEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        const scrollContainer = document.querySelector('main.overflow-y-auto');
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, issueId]);

  const fetchIssueDetails = async () => {
    try {
      setLoading(true);

      // Fetch issue details
      const response = await api.get(`/issues/${issueId}`);
      const issueData = response.data?.issue;

      if (!issueData) {
        addToast({ title: 'Error', message: 'Issue not found', type: 'error' });
        navigate('/admin/issues');
        return;
      }
      setIssue(issueData);
      setEstimatedCostInput(
        issueData.estimated_cost !== null && issueData.estimated_cost !== undefined
          ? issueData.estimated_cost.toString()
          : ''
      );

      // Set comments from the response
      const commentsData = response.data?.comments || [];
      setComments(commentsData);

      // Set attachments from the response
      const attachmentsData = response.data?.attachments || [];
      setAttachments(attachmentsData);

      // Fetch related asset if available
      if (issueData.asset_id) {
        try {
          const assetData = await assetService.getById(issueData.asset_id);
          setAsset(assetData);
        } catch (error) {
          // console.log('Asset not found or error fetching asset:', error);
        }
      }

      // Fetch users, departments, and asset types
      const [usersData, departmentsData, typesData] = await Promise.all([
        userService.getAll(),
        departmentService.getAll(),
        assetRequestTypeService.getAll()
      ]);
      setUsers(usersData);
      setDepartments(departmentsData);
      setAssetRequestTypes(typesData || []);

    } catch (error: any) {
      console.error('Error fetching issue details:', error);
      addToast({ title: 'Error', message: 'Failed to load issue details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !issueId) return;

    try {
      setSubmittingComment(true);

      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          content: newComment.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const result = await response.json();
      setComments([...comments, result.comment]);
      setNewComment('');
      addToast({ title: 'Success', message: 'Comment added successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      addToast({ title: 'Error', message: 'Failed to add comment', type: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!issue || !newStatus || newStatus === issue.status) return;

    try {
      setIsUpdatingStatus(true);
      const updatedIssue = await issueService.update(issue.id, { status: newStatus } as any);
      setIssue(updatedIssue);
      setEstimatedCostInput(
        updatedIssue.estimated_cost !== null && updatedIssue.estimated_cost !== undefined
          ? updatedIssue.estimated_cost.toString()
          : ''
      );
      setNewStatus('');
      addToast({ title: 'Success', message: 'Status updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error updating status:', error);
      addToast({ title: 'Error', message: 'Failed to update status', type: 'error' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignIssue = async () => {
    if (!issue || !assignToUserId) return;

    try {
      setIsAssigning(true);
      const updatedIssue = await issueService.update(issue.id, { assigned_to: assignToUserId } as any);
      setIssue(updatedIssue);
      setEstimatedCostInput(
        updatedIssue.estimated_cost !== null && updatedIssue.estimated_cost !== undefined
          ? updatedIssue.estimated_cost.toString()
          : ''
      );
      setAssignToUserId('');
      addToast({ title: 'Success', message: 'Issue assigned successfully', type: 'success' });

      // Send notification to assigned user
      try {
        await notificationService.notifyUser(assignToUserId, 'Issue Assigned', `You have been assigned issue "${updatedIssue.title}".`, 'info');
      } catch (error) {
        // console.log('Failed to send notification:', error);
      }
    } catch (error: any) {
      console.error('Error assigning issue:', error);
      addToast({ title: 'Error', message: 'Failed to assign issue', type: 'error' });
    } finally {
      setIsAssigning(false);
    }
  };

  const startEditComment = (comment: IssueComment) => {
    setEditingComment(comment);
    setEditCommentContent(comment.content);
  };

  const cancelEditComment = () => {
    setEditingComment(null);
    setEditCommentContent('');
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;

    try {
      const updatedComment = await commentService.update(issueId!, commentId, editCommentContent.trim());
      setComments(comments.map(c => c.id === commentId ? updatedComment : c));
      setEditingComment(null);
      setEditCommentContent('');
      addToast({ title: 'Success', message: 'Comment updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error updating comment:', error);
      addToast({ title: 'Error', message: 'Failed to update comment', type: 'error' });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.delete(issueId!, commentId);
      setComments(comments.filter(c => c.id !== commentId));
      addToast({ title: 'Success', message: 'Comment deleted successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      addToast({ title: 'Error', message: 'Failed to delete comment', type: 'error' });
    }
  };

  const handleUpdateEstimatedCost = async () => {
    if (!issue || !isAdmin) return;
    const trimmed = estimatedCostInput.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      addToast({ title: 'Invalid Cost', message: 'Estimated cost must be a positive number.', type: 'error' });
      return;
    }

    try {
      setIsUpdatingEstimatedCost(true);
      const updatedIssue = await issueService.update(issue.id, { estimated_cost: value } as any);
      setIssue(updatedIssue);
      setEstimatedCostInput(
        updatedIssue.estimated_cost !== null && updatedIssue.estimated_cost !== undefined
          ? updatedIssue.estimated_cost.toString()
          : ''
      );
      addToast({ title: 'Estimated Cost Updated', message: 'Issue cost has been updated.', type: 'success' });
    } catch (error) {
      console.error('Error updating estimated cost:', error);
      addToast({ title: 'Error', message: 'Failed to update estimated cost.', type: 'error' });
    } finally {
      setIsUpdatingEstimatedCost(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
      case 'closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReporterName = (reporterId: string) => {
    const reporter = users.find(u => u.id === reporterId);
    return reporter ? reporter.name : 'Unknown User';
  };

  const getAssetName = (assetId: string) => {
    if (asset && asset.id === assetId) {
      return asset.name;
    }
    return 'Unknown Asset';
  };

  const getAssetImage = (assetId: string) => {
    if (asset && asset.id === assetId) {
      return asset.image_url || '/api/placeholder/32/32';
    }
    return '/api/placeholder/32/32';
  };

  // Get IT department IDs
  const itDeptIds = new Set(
    departments
      .filter(d => d.name?.toLowerCase().includes('it'))
      .map(d => d.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-8 text-center">
            <XCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Issue Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">The issue you're looking for doesn't exist or you don't have permission to view it.</p>
            <Link
              to="/admin/issues"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Issues
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/admin/issues"
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Issues
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Issue Details</h1>
        </div>

        <div className="space-y-6">
          {/* Issue Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-3">
                <AlertCircleIcon className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issue.title || 'Untitled Issue'}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(issue.status || 'open')}`}>
                  {(issue.status || 'open').charAt(0).toUpperCase() + (issue.status || 'open').slice(1).replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(issue.priority || 'Low')}`}>
                  {issue.priority || 'Low'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {issue.category || 'General'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <CalendarIcon className="w-5 h-5" />
                  <span>Reported: {issue.created_at ? formatDate(issue.created_at) : 'Unknown'}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <ClockIcon className="w-5 h-5" />
                  <span>Last Updated: {issue.updated_at ? formatDate(issue.updated_at) : 'Unknown'}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <TagIcon className="w-5 h-5" />
                  <span>Category: {issue.category || 'General'}</span>
                </div>
              </div>
              <div className="space-y-4">
                {asset && (
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <AlertCircleIcon className="w-5 h-5" />
                    <Link
                      to={`/assets/${asset.id}`}
                      className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 dark:border-gray-800">
                        <AssetImage
                          asset={asset}
                          assetType={assetRequestTypes.find(t => t.name === asset.type)}
                        />
                      </div>
                      <span>{getAssetName(asset.id)}</span>
                    </Link>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <UserIcon className="w-5 h-5" />
                  <span>Reported by: {getReporterName(issue.reported_by || '')}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Description</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {issue.description || 'No description provided'}
                </p>
              </div>
            </div>

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <TagIcon className="w-5 h-5 mr-2" />
                  Attachments ({attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map((file) => (
                    <AttachmentItem
                      key={file.id}
                      file={file}
                      onPreview={(url, name) => {
                        setPreviewImage(url);
                        setPreviewFileName(name);
                        setIsPreviewOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Estimated Cost</h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-blue-100 rounded-full">
                        <DollarSignIcon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(issue.estimated_cost)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{DEFAULT_CURRENCY}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
                    <div className="flex-1 flex items-center space-x-2">
                      <span className="text-gray-500 dark:text-gray-400">{DEFAULT_CURRENCY}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={estimatedCostInput}
                        onChange={(e) => setEstimatedCostInput(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter estimated cost"
                      />
                    </div>
                    <button
                      onClick={handleUpdateEstimatedCost}
                      disabled={isUpdatingEstimatedCost}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {isUpdatingEstimatedCost ? 'Updating...' : 'Update Cost'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Assignment Section */}
            {canManageIssue && (
              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Assign To (IT Department)</label>
                <div className="flex items-center space-x-2">
                  <select
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700"
                    value={assignToUserId}
                    onChange={e => setAssignToUserId(e.target.value)}
                  >
                    <option value="">Select IT User</option>
                    {(() => {
                      const itUsers = users.filter(u => u.department_id && itDeptIds.has(u.department_id));
                      if (itUsers.length === 0) {
                        return <option value="" disabled>No IT users found</option>;
                      }
                      return itUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ));
                    })()}
                  </select>
                  <button
                    onClick={handleAssignIssue}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
                    disabled={isAssigning || !assignToUserId}
                  >
                    {isAssigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            )}

            {/* Status Update Section */}
            {canManageIssue && (
              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Update Status</label>
                <div className="flex space-x-2">
                  <select
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isUpdatingStatus || newStatus === (issue.status || 'open') || !newStatus}
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            )}
          </div>



          <ImagePreviewModal
            isOpen={isPreviewOpen}
            imageUrl={previewImage}
            fileName={previewFileName}
            onClose={() => setIsPreviewOpen(false)}
          />

          {/* Comments Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <MessageCircleIcon className="w-5 h-5 mr-2" />
              Comments ({comments.length})
            </h3>

            {/* Add Comment Form */}
            {canManageIssue && (
              <form onSubmit={(e) => { e.preventDefault(); handleAddComment(); }} className="mb-6">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700"
                    placeholder="Type your comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {submittingComment ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <MessageCircleIcon className="w-4 h-4 mr-2" />
                    )}
                    {submittingComment ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
              </form>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageCircleIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No comments yet. Be the first to add one!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {comment.user_name || 'Unknown User'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(comment.created_at)}
                          </p>
                        </div>
                      </div>
                      {canManageIssue && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => startEditComment(comment)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                            title="Edit Comment"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                            title="Delete Comment"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="ml-10">
                      {editingComment?.id === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            rows={3}
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditComment(comment.id)}
                              className="px-3 py-1 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditComment}
                              className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IssueDetail;
