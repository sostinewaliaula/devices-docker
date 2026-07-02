import React, { useState, useEffect } from 'react';
import { 
  MessageCircleIcon, 
  SendIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  XIcon
} from 'lucide-react';
import api from '../services/apiService';
import { useNotifications } from '../contexts/NotificationContext';
import ConfirmationModal from './ui/ConfirmationModal';

interface Comment {
  id: string;
  asset_request_id: string;
  user_id: string;
  comment: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  replies: Comment[];
}

interface CommentsSectionProps {
  assetRequestId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ 
  assetRequestId, 
  currentUserId, 
  isAdmin = false 
}) => {
  const { addToast } = useNotifications();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [updatingComment, setUpdatingComment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [assetRequestId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/comments/asset-requests/${assetRequestId}/comments`);
      if (response.data.success) {
        setComments(response.data.data.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await api.post(`/comments/asset-requests/${assetRequestId}/comments`, {
        comment: newComment.trim(),
        parentCommentId: null
      });

      if (response.data.success) {
        setNewComment('');
        await fetchComments(); // Refresh comments
        addToast({
          title: 'Comment Added',
          message: 'Your comment has been added successfully',
          type: 'success'
        });
      } else {
        addToast({
          title: 'Error',
          message: response.data.message || 'Failed to add comment',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add comment';
      addToast({
        title: 'Error',
        message: `Failed to add comment: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const addReply = async (parentCommentId: string) => {
    if (!replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const response = await api.post(`/comments/asset-requests/${assetRequestId}/comments`, {
        comment: replyText.trim(),
        parentCommentId: parentCommentId
      });

      if (response.data.success) {
        setReplyText('');
        setReplyingTo(null);
        await fetchComments(); // Refresh comments
        addToast({
          title: 'Reply Added',
          message: 'Your reply has been added successfully',
          type: 'success'
        });
      } else {
        addToast({
          title: 'Error',
          message: response.data.message || 'Failed to add reply',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error adding reply:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to add reply';
      addToast({
        title: 'Error',
        message: `Failed to add reply: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const updateComment = async (commentId: string) => {
    if (!editText.trim() || updatingComment) return;

    setUpdatingComment(true);
    try {
      const response = await api.put(`/comments/asset-requests/${assetRequestId}/comments/${commentId}`, {
        comment: editText.trim()
      });

      if (response.data.success) {
        setEditingComment(null);
        setEditText('');
        await fetchComments(); // Refresh comments
        addToast({
          title: 'Comment Updated',
          message: 'Your comment has been updated successfully',
          type: 'success'
        });
      } else {
        addToast({
          title: 'Error',
          message: response.data.message || 'Failed to update comment',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error updating comment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update comment';
      addToast({
        title: 'Error',
        message: `Failed to update comment: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setUpdatingComment(false);
    }
  };

  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!commentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.delete(`/comments/asset-requests/${assetRequestId}/comments/${commentToDelete}`);

      if (response.data.success) {
        fetchComments(); // Refresh comments
        addToast({
          title: 'Comment Deleted',
          message: 'Your comment has been deleted successfully',
          type: 'success'
        });
      } else {
        addToast({
          title: 'Error',
          message: response.data.message || 'Failed to delete comment',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete comment';
      addToast({
        title: 'Error',
        message: `Failed to delete comment: ${errorMessage}`,
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setCommentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setCommentToDelete(null);
  };

  const startEdit = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditText('');
  };

  const startReply = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyText('');
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const canEditOrDelete = (comment: Comment) => {
    return comment.user_id === currentUserId || isAdmin;
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 mt-3' : 'mb-4'}`}>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {comment.user_name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimeAgo(comment.created_at)}
              </span>
            </div>
            
            {editingComment === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  disabled={updatingComment}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={3}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateComment(comment.id)}
                    disabled={!editText.trim() || updatingComment}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingComment ? (
                      <>
                        <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4 mr-1" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={updatingComment}
                    className="px-3 py-1 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XIcon className="w-4 h-4 mr-1" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300">{comment.comment}</p>
            )}
          </div>
          
          {canEditOrDelete(comment) && editingComment !== comment.id && (
            <div className="flex space-x-1 ml-2">
              <button
                onClick={() => startEdit(comment)}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                title="Edit comment"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(comment.id)}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Delete comment"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        {!isReply && (
          <div className="mt-3">
            <button
              onClick={() => startReply(comment.id)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Reply
            </button>
          </div>
        )}
      </div>
      
      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="mt-3 ml-4">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            disabled={submittingReply}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={3}
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={() => addReply(comment.id)}
              disabled={!replyText.trim() || submittingReply}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingReply ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Replying...
                </>
              ) : (
                <>
                  <SendIcon className="w-4 h-4 mr-1" />
                  Reply
                </>
              )}
            </button>
            <button
              onClick={cancelReply}
              disabled={submittingReply}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3">
          {comment.replies.map((reply) => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <MessageCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Add new comment */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          disabled={submitting}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          rows={3}
        />
        <div className="flex justify-end mt-3">
            <button
              onClick={addComment}
              disabled={!newComment.trim() || submitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <SendIcon className="w-4 h-4 mr-1" />
                  Add Comment
                </>
              )}
            </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircleIcon className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default CommentsSection;
