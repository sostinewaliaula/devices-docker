import React, { useEffect, useState, useLayoutEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { issueService, assetService, assetRequestTypeService } from '../../services/apiDatabase';
import AssetImage from '../../components/AssetImage';
import {
  ArrowLeftIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  MessageCircleIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  SendIcon,
  EditIcon,
  TrashIcon,
  SaveIcon
} from 'lucide-react';
import AttachmentItem from '../../components/AttachmentItem';
import ImagePreviewModal from '../../components/ImagePreviewModal';

interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

const UserIssueDetail: React.FC = () => {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useNotifications();

  const [issue, setIssue] = useState<any>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [asset, setAsset] = useState<any>(null);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Edit functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    category: ''
  });
  const [saving, setSaving] = useState(false);

  // Delete functionality
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      // Fetch issue details (includes comments)
      const response = await issueService.getById(issueId!);
      // console.log('Fetched issue response:', response);

      if (!response) {
        addToast({ title: 'Error', message: 'Issue not found', type: 'error' });
        navigate('/user/issues');
        return;
      }

      // The backend returns { issue, comments, attachments } structure
      const issueData = (response as any).issue || response;
      const commentsData = (response as any).comments || [];
      const attachmentsData = (response as any).attachments || [];

      setIssue(issueData);
      setComments(commentsData);
      setAttachments(attachmentsData);

      // Fetch related asset and asset types if available
      if (issueData.asset_id) {
        try {
          const [assetData, typesData] = await Promise.all([
            assetService.getById(issueData.asset_id),
            assetRequestTypeService.getAll()
          ]);
          setAsset(assetData);
          setAssetRequestTypes(typesData || []);
        } catch (error) {
          // console.log('Asset not found or error fetching asset:', error);
        }
      }
    } catch (error: any) {
      console.error('Error fetching issue details:', error);
      addToast({ title: 'Error', message: 'Failed to load issue details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !issueId) return;

    try {
      setSubmittingComment(true);

      // Use the issues API endpoint for creating comments
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

      // Add the new comment to the list
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

  // Edit functionality
  const handleEditIssue = () => {
    if (!issue) return;

    setEditForm({
      title: issue.title || '',
      description: issue.description || '',
      status: issue.status || 'open',
      priority: issue.priority || 'medium',
      category: issue.category || ''
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!issueId) return;

    try {
      setSaving(true);

      const updatedIssue = await issueService.update(issueId, editForm);

      // Update local state
      setIssue({ ...issue, ...updatedIssue });
      setIsEditing(false);

      addToast({ title: 'Success', message: 'Issue updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error updating issue:', error);
      addToast({ title: 'Error', message: 'Failed to update issue', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      title: '',
      description: '',
      status: '',
      priority: '',
      category: ''
    });
  };

  // Delete functionality
  const handleDeleteIssue = async () => {
    if (!issueId) return;

    try {
      setDeleting(true);

      await issueService.delete(issueId);

      addToast({ title: 'Success', message: 'Issue deleted successfully', type: 'success' });
      navigate('/user/issues');
    } catch (error: any) {
      console.error('Error deleting issue:', error);
      addToast({ title: 'Error', message: 'Failed to delete issue', type: 'error' });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Check if user can edit/delete this issue
  const canEditIssue = () => {
    if (!user || !issue) return false;
    return user.role === 'admin' || user.role === 'manager' || issue.reported_by === user.id;
  };

  const getStatusIcon = (status: string | undefined) => {
    if (!status) return <AlertCircleIcon className="w-5 h-5 text-gray-500" />;

    switch (status) {
      case 'open':
        return <AlertCircleIcon className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'resolved':
      case 'closed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';

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

  const getPriorityColor = (priority: string | undefined) => {
    if (!priority) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-8 text-center">
            <XCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Issue Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">The issue you're looking for doesn't exist or you don't have permission to view it.</p>
            <Link
              to="/user/issues"
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/user/issues"
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
                {getStatusIcon(issue.status)}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {issue.title || 'Untitled Issue'}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(issue.status)}`}>
                  {issue.status ? issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('_', ' ') : 'Unknown'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(issue.priority)}`}>
                  {issue.priority || 'Unknown'}
                </span>
                {canEditIssue() && (
                  <div className="flex items-center space-x-4 ml-4">
                    <button
                      onClick={handleEditIssue}
                      className="flex items-center space-x-2 text-green-500 hover:text-green-400 transition-colors"
                      title="Edit Issue"
                    >
                      <EditIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex items-center space-x-2 text-red-500 hover:text-red-400 transition-colors"
                      title="Delete Issue"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                  </div>
                )}
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
                      <span>Related Asset: {asset.name}</span>
                    </Link>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                  <UserIcon className="w-5 h-5" />
                  <span>Reported by: {issue.reported_by_name || 'Unknown'}</span>
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

            {issue.resolution && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Resolution</h3>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {issue.resolution}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
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
            <form onSubmit={handleAddComment} className="mb-6">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={3}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {submittingComment ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  ) : (
                    <SendIcon className="w-4 h-4 mr-2" />
                  )}
                  {submittingComment ? 'Adding...' : 'Add Comment'}
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageCircleIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No comments yet. Be the first to comment!</p>
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
                    </div>
                    <div className="ml-10">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Edit Issue Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Issue</h3>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      minLength={5}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={4}
                      required
                      minLength={10}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={editForm.priority}
                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Hardware, Software, Network"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <SaveIcon className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-4">
                    <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Issue</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this issue? This will permanently remove the issue and all its comments.
                </p>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteIssue}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete Issue
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserIssueDetail;
