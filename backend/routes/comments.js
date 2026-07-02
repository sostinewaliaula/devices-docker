import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import commentService from '../services/commentService.js';

const router = express.Router();

// Add comment to asset request
router.post('/asset-requests/:assetRequestId/comments', authenticateToken, async (req, res) => {
  try {
    const { comment, parentCommentId } = req.body;
    const assetRequestId = req.params.assetRequestId;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    const commentId = await commentService.addComment(
      assetRequestId,
      req.user.id,
      comment.trim(),
      parentCommentId
    );

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { commentId }
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// Get comments for asset request
router.get('/asset-requests/:assetRequestId/comments', authenticateToken, async (req, res) => {
  try {
    const assetRequestId = req.params.assetRequestId;
    const comments = await commentService.getComments(assetRequestId);

    res.json({
      success: true,
      data: { comments }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
});

// Update comment
router.put('/asset-requests/:assetRequestId/comments/:id', authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body;
    const commentId = req.params.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    await commentService.updateComment(commentId, req.user.id, comment.trim());

    res.json({
      success: true,
      message: 'Comment updated successfully'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update comment'
    });
  }
});

// Delete comment
router.delete('/asset-requests/:assetRequestId/comments/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const isAdmin = req.user.role === 'admin';

    await commentService.deleteComment(commentId, req.user.id, isAdmin);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
});

// Get comment by ID
router.get('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const comment = await commentService.getCommentById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    res.json({
      success: true,
      data: { comment }
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comment'
    });
  }
});

// Get comment count for asset request
router.get('/asset-requests/:assetRequestId/comments/count', authenticateToken, async (req, res) => {
  try {
    const assetRequestId = req.params.assetRequestId;
    const count = await commentService.getCommentCount(assetRequestId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error getting comment count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comment count'
    });
  }
});

export default router;
