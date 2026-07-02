import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const includeInactive = (req.query.includeInactive || '').toString().toLowerCase() === 'true';
    const search = (req.query.search || '').toString().trim();

    const filters = [];
    const params = [];

    if (!includeInactive) {
      filters.push('is_active = 1');
    }
    if (search) {
      filters.push('(name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await executeQuery(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM issue_categories
       ${whereClause}
       ORDER BY name ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch issue categories', message: result.error });
    }

    res.json({ categories: result.data });
  } catch (error) {
    console.error('Get issue categories error:', error);
    res.status(500).json({ error: 'Failed to fetch issue categories', message: error.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [body('name').trim().isLength({ min: 2 }).withMessage('Name is required'), body('description').optional().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, description, is_active = true } = req.body;

      const existing = await executeQuery('SELECT id FROM issue_categories WHERE name = ?', [name]);
      if (existing.success && existing.data.length > 0) {
        return res.status(400).json({ error: 'Issue category already exists' });
      }

      const { randomUUID } = await import('crypto');
      const categoryId = randomUUID();

      const result = await executeQuery(
        `INSERT INTO issue_categories (id, name, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [categoryId, name, description || null, is_active ? 1 : 0]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Failed to create issue category', message: result.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, created_at, updated_at FROM issue_categories WHERE id = ?',
        [categoryId]
      );

      res.status(201).json({ category: fetchResult.data[0] });
    } catch (error) {
      console.error('Create issue category error:', error);
      res.status(500).json({ error: 'Failed to create issue category', message: error.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name').optional().trim().isLength({ min: 2 }),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { name, description, is_active } = req.body;

      const existing = await executeQuery('SELECT id FROM issue_categories WHERE id = ?', [id]);
      if (!existing.success || existing.data.length === 0) {
        return res.status(404).json({ error: 'Issue category not found' });
      }

      if (name) {
        const duplicate = await executeQuery('SELECT id FROM issue_categories WHERE name = ? AND id != ?', [name, id]);
        if (duplicate.success && duplicate.data.length > 0) {
          return res.status(400).json({ error: 'Another issue category with this name already exists' });
        }
      }

      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description || null);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const updateResult = await executeQuery(
        `UPDATE issue_categories SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (!updateResult.success) {
        return res.status(500).json({ error: 'Failed to update issue category', message: updateResult.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, created_at, updated_at FROM issue_categories WHERE id = ?',
        [id]
      );

      res.json({ category: fetchResult.data[0] });
    } catch (error) {
      console.error('Update issue category error:', error);
      res.status(500).json({ error: 'Failed to update issue category', message: error.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery('SELECT id FROM issue_categories WHERE id = ?', [id]);
    if (!existing.success || existing.data.length === 0) {
      return res.status(404).json({ error: 'Issue category not found' });
    }

    const result = await executeQuery('DELETE FROM issue_categories WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to delete issue category', message: result.error });
    }

    res.json({ message: 'Issue category deleted successfully' });
  } catch (error) {
    console.error('Delete issue category error:', error);
    res.status(500).json({ error: 'Failed to delete issue category', message: error.message });
  }
});

export default router;

