import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all backup email recipients (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await executeQuery(
      'SELECT * FROM backup_email_recipients ORDER BY created_at DESC'
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch backup email recipients'
      });
    }

    res.json({
      success: true,
      data: result.data || []
    });
  } catch (error) {
    console.error('Error fetching backup email recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backup email recipients'
    });
  }
});

// Create new backup email recipient (admin only)
router.post('/', requireAdmin, [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email } = req.body;

    // Check if email already exists
    const existingResult = await executeQuery(
      'SELECT id FROM backup_email_recipients WHERE email = ?',
      [email]
    );

    if (!existingResult.success) {
      return res.status(500).json({
        success: false,
        error: existingResult.error || 'Database error while checking existing recipient'
      });
    }

    if (existingResult.data && existingResult.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists in backup recipients'
      });
    }

    const insertResult = await executeQuery(
      'INSERT INTO backup_email_recipients (email) VALUES (?)',
      [email]
    );

    if (!insertResult.success) {
      return res.status(500).json({
        success: false,
        error: insertResult.error || 'Failed to create backup email recipient'
      });
    }

    // Get the insertId - handle both MySQL and PostgreSQL formats
    const insertId = insertResult.data?.insertId || (Array.isArray(insertResult.data) && insertResult.data[0]?.insertId) || (insertResult.data?.[0]?.id);
    
    // For UUID-based IDs, we need to query by email instead
    let newRecipientResult;
    if (insertId) {
      newRecipientResult = await executeQuery(
        'SELECT * FROM backup_email_recipients WHERE id = ?',
        [insertId]
      );
    } else {
      // Fallback: query by email
      newRecipientResult = await executeQuery(
        'SELECT * FROM backup_email_recipients WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [email]
      );
    }

    if (!newRecipientResult.success || !newRecipientResult.data || newRecipientResult.data.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve created recipient'
      });
    }

    res.status(201).json({
      success: true,
      data: newRecipientResult.data[0]
    });
  } catch (error) {
    console.error('Error creating backup email recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup email recipient'
    });
  }
});

// Update backup email recipient (admin only)
router.put('/:id', requireAdmin, [
  body('email').optional().isEmail().withMessage('Valid email is required if provided'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { email, is_active } = req.body;

    // Check if recipient exists
    const existingResult = await executeQuery(
      'SELECT * FROM backup_email_recipients WHERE id = ?',
      [id]
    );

    if (!existingResult.success) {
      return res.status(500).json({
        success: false,
        error: existingResult.error || 'Database error'
      });
    }

    if (!existingResult.data || existingResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Backup email recipient not found'
      });
    }

    const currentRecipient = existingResult.data[0];
    const updateEmail = email !== undefined ? email : currentRecipient.email;
    const updateActive = is_active !== undefined ? is_active : currentRecipient.is_active;

    // If email is being updated, check for duplicates
    if (email !== undefined && email !== currentRecipient.email) {
      const duplicateResult = await executeQuery(
        'SELECT id FROM backup_email_recipients WHERE email = ? AND id != ?',
        [email, id]
      );

      if (!duplicateResult.success) {
        return res.status(500).json({
          success: false,
          error: duplicateResult.error || 'Database error'
        });
      }

      if (duplicateResult.data && duplicateResult.data.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists in backup recipients'
        });
      }
    }

    // Update recipient (email and/or is_active)
    const updateResult = await executeQuery(
      'UPDATE backup_email_recipients SET email = ?, is_active = ? WHERE id = ?',
      [updateEmail, updateActive, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error || 'Failed to update recipient'
      });
    }

    const updatedResult = await executeQuery(
      'SELECT * FROM backup_email_recipients WHERE id = ?',
      [id]
    );

    if (!updatedResult.success || !updatedResult.data || updatedResult.data.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve updated recipient'
      });
    }

    res.json({
      success: true,
      data: updatedResult.data[0]
    });
  } catch (error) {
    console.error('Error updating backup email recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update backup email recipient'
    });
  }
});

// Delete backup email recipient (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if recipient exists
    const existingResult = await executeQuery(
      'SELECT id FROM backup_email_recipients WHERE id = ?',
      [id]
    );

    if (!existingResult.success) {
      return res.status(500).json({
        success: false,
        error: existingResult.error || 'Database error'
      });
    }

    if (!existingResult.data || existingResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Backup email recipient not found'
      });
    }

    const deleteResult = await executeQuery(
      'DELETE FROM backup_email_recipients WHERE id = ?',
      [id]
    );

    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        error: deleteResult.error || 'Failed to delete recipient'
      });
    }

    res.json({
      success: true,
      message: 'Backup email recipient deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting backup email recipient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup email recipient'
    });
  }
});

export default router;


