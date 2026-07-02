import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all dropdown options, optionally filtered by type
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, includeInactive } = req.query;
    const filters = [];
    const params = [];

    if (type) {
      filters.push('type = ?');
      params.push(type);
    }

    if (includeInactive !== 'true') {
      filters.push('is_active = 1');
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await executeQuery(
      `SELECT id, type, value, is_active, created_at, updated_at
       FROM dropdown_options
       ${whereClause}
       ORDER BY type ASC, value ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch dropdown options', message: result.error });
    }

    res.json({ options: result.data });
  } catch (error) {
    console.error('Get dropdown options error:', error);
    res.status(500).json({ error: 'Failed to fetch dropdown options', message: error.message });
  }
});

// Create a dropdown option
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('type').trim().notEmpty().withMessage('Type is required'),
    body('value').trim().notEmpty().withMessage('Value is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { type, value, is_active = true } = req.body;

      const result = await executeQuery(
        `INSERT INTO dropdown_options (type, value, is_active)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
        [type, value, is_active ? 1 : 0]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Failed to create dropdown option', message: result.error });
      }

      const id = result.data.insertId;
      const fetchResult = await executeQuery(
        'SELECT * FROM dropdown_options WHERE id = ?',
        [id]
      );

      res.status(201).json({ option: fetchResult.data[0] });
    } catch (error) {
      console.error('Create dropdown option error:', error);
      res.status(500).json({ error: 'Failed to create dropdown option', message: error.message });
    }
  }
);

// Update a dropdown option
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    body('type').optional().trim().notEmpty(),
    body('value').optional().trim().notEmpty(),
    body('is_active').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { type, value, is_active } = req.body;

      const updates = [];
      const params = [];

      if (type !== undefined) {
        updates.push('type = ?');
        params.push(type);
      }
      if (value !== undefined) {
        updates.push('value = ?');
        params.push(value);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      params.push(id);

      const updateResult = await executeQuery(
        `UPDATE dropdown_options SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (!updateResult.success) {
        return res.status(500).json({ error: 'Failed to update dropdown option', message: updateResult.error });
      }

      const fetchResult = await executeQuery(
        'SELECT * FROM dropdown_options WHERE id = ?',
        [id]
      );

      res.json({ option: fetchResult.data[0] });
    } catch (error) {
      console.error('Update dropdown option error:', error);
      res.status(500).json({ error: 'Failed to update dropdown option', message: error.message });
    }
  }
);

// Delete a dropdown option
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await executeQuery('DELETE FROM dropdown_options WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to delete dropdown option', message: result.error });
    }

    res.json({ message: 'Dropdown option deleted successfully' });
  } catch (error) {
    console.error('Delete dropdown option error:', error);
    res.status(500).json({ error: 'Failed to delete dropdown option', message: error.message });
  }
});

export default router;
