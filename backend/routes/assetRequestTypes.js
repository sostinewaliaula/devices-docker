import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
      `SELECT id, name, description, is_active, image_data, image_type, created_at, updated_at
       FROM asset_request_types
       ${whereClause}
       ORDER BY name ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch asset request types', message: result.error });
    }

    res.json({ types: result.data });
  } catch (error) {
    console.error('Get asset request types error:', error);
    res.status(500).json({ error: 'Failed to fetch asset request types', message: error.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  upload.single('image'),
  [body('name').trim().isLength({ min: 2 }).withMessage('Name is required'), body('description').optional().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, description, is_active = true } = req.body;

      const existing = await executeQuery('SELECT id FROM asset_request_types WHERE name = ?', [name]);
      if (existing.success && existing.data.length > 0) {
        return res.status(400).json({ error: 'Asset type already exists' });
      }

      const { randomUUID } = await import('crypto');
      const typeId = randomUUID();

      const image_data = req.file ? req.file.buffer : null;
      const image_type = req.file ? req.file.mimetype : null;

      const result = await executeQuery(
        `INSERT INTO asset_request_types (id, name, description, is_active, image_data, image_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [typeId, name, description || null, is_active ? 1 : 0, image_data, image_type]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Failed to create asset type', message: result.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, image_data, image_type, created_at, updated_at FROM asset_request_types WHERE id = ?',
        [typeId]
      );

      res.status(201).json({ type: fetchResult.data[0] });
    } catch (error) {
      console.error('Create asset request type error:', error);
      res.status(500).json({ error: 'Failed to create asset type', message: error.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  upload.single('image'),
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

      const existing = await executeQuery('SELECT id FROM asset_request_types WHERE id = ?', [id]);
      if (!existing.success || existing.data.length === 0) {
        return res.status(404).json({ error: 'Asset type not found' });
      }

      if (name) {
        const duplicate = await executeQuery('SELECT id FROM asset_request_types WHERE name = ? AND id != ?', [name, id]);
        if (duplicate.success && duplicate.data.length > 0) {
          return res.status(400).json({ error: 'Another asset type with this name already exists' });
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
      if (req.file) {
        updates.push('image_data = ?');
        params.push(req.file.buffer);
        updates.push('image_type = ?');
        params.push(req.file.mimetype);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No changes provided' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const updateResult = await executeQuery(
        `UPDATE asset_request_types SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (!updateResult.success) {
        return res.status(500).json({ error: 'Failed to update asset type', message: updateResult.error });
      }

      const fetchResult = await executeQuery(
        'SELECT id, name, description, is_active, image_data, image_type, created_at, updated_at FROM asset_request_types WHERE id = ?',
        [id]
      );

      res.json({ type: fetchResult.data[0] });
    } catch (error) {
      console.error('Update asset request type error:', error);
      res.status(500).json({ error: 'Failed to update asset type', message: error.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery('SELECT id FROM asset_request_types WHERE id = ?', [id]);
    if (!existing.success || existing.data.length === 0) {
      return res.status(404).json({ error: 'Asset type not found' });
    }

    const result = await executeQuery('DELETE FROM asset_request_types WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to delete asset type', message: result.error });
    }

    res.json({ message: 'Asset type deleted successfully' });
  } catch (error) {
    console.error('Delete asset request type error:', error);
    res.status(500).json({ error: 'Failed to delete asset type', message: error.message });
  }
});

export default router;

