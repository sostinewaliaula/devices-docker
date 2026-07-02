import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const includeInactive = (req.query.includeInactive || '').toString().toLowerCase() === 'true';
    const search = (req.query.search || '').toString().trim();

    let whereClause = 'WHERE is_active = 1';
    const params = [];
    if (includeInactive) {
      whereClause = 'WHERE 1=1';
    }
    if (search) {
      whereClause += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    const result = await executeQuery(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM positions
       ${whereClause}
       ORDER BY name ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch positions', message: result.error });
    }

    res.json({ positions: result.data });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ error: 'Failed to fetch positions', message: error.message });
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

      const existing = await executeQuery('SELECT id FROM positions WHERE name = ?', [name]);
      if (existing.success && existing.data.length > 0) {
        return res.status(400).json({ error: 'Position already exists' });
      }

      const { randomUUID } = await import('crypto');
      const positionId = randomUUID();

      const result = await executeQuery(
        `INSERT INTO positions (id, name, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [positionId, name, description || null, is_active ? 1 : 0]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Failed to create position', message: result.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, created_at, updated_at FROM positions WHERE id = ?',
        [positionId]
      );

      res.status(201).json({ position: fetchResult.data[0] });
    } catch (error) {
      console.error('Create position error:', error);
      res.status(500).json({ error: 'Failed to create position', message: error.message });
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

      const existing = await executeQuery('SELECT id FROM positions WHERE id = ?', [id]);
      if (!existing.success || existing.data.length === 0) {
        return res.status(404).json({ error: 'Position not found' });
      }

      if (name) {
        const duplicate = await executeQuery('SELECT id FROM positions WHERE name = ? AND id != ?', [name, id]);
        if (duplicate.success && duplicate.data.length > 0) {
          return res.status(400).json({ error: 'Another position with this name already exists' });
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
        `UPDATE positions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (!updateResult.success) {
        return res.status(500).json({ error: 'Failed to update position', message: updateResult.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, created_at, updated_at FROM positions WHERE id = ?',
        [id]
      );

      res.json({ position: fetchResult.data[0] });
    } catch (error) {
      console.error('Update position error:', error);
      res.status(500).json({ error: 'Failed to update position', message: error.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery('SELECT id FROM positions WHERE id = ?', [id]);
    if (!existing.success || existing.data.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const result = await executeQuery('DELETE FROM positions WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to delete position', message: result.error });
    }

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ error: 'Failed to delete position', message: error.message });
  }
});

export default router;

