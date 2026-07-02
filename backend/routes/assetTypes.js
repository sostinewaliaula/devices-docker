import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all asset types
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
      `SELECT id, name, description, parameters_schema, is_active, created_at, updated_at
       FROM asset_types
       ${whereClause}
       ORDER BY name ASC`,
      params
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch asset types', message: result.error });
    }

    res.json({ types: result.data });
  } catch (error) {
    console.error('Get asset types error:', error);
    res.status(500).json({ error: 'Failed to fetch asset types', message: error.message });
  }
});

// Create an asset type
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
    body('description').optional().trim(),
    body('parameters_schema').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { name, description, parameters_schema, is_active = true } = req.body;

      const existing = await executeQuery('SELECT id FROM asset_types WHERE name = ?', [name]);
      if (existing.success && existing.data.length > 0) {
        return res.status(400).json({ error: 'Asset type already exists' });
      }

      const { randomUUID } = await import('crypto');
      const typeId = randomUUID();

      const schemaStr = parameters_schema ? JSON.stringify(parameters_schema) : '[]';

      const result = await executeQuery(
        `INSERT INTO asset_types (id, name, description, parameters_schema, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [typeId, name, description || null, schemaStr, is_active ? 1 : 0]
      );

      if (!result.success) {
        return res.status(500).json({ error: 'Failed to create asset type', message: result.error });
      }

      const fetchResult = await executeQuery(
        'SELECT * FROM asset_types WHERE id = ?',
        [typeId]
      );

      res.status(201).json({ type: fetchResult.data[0] });
    } catch (error) {
      console.error('Create asset type error:', error);
      res.status(500).json({ error: 'Failed to create asset type', message: error.message });
    }
  }
);

// Update an asset type
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [
    body('name').optional().trim().isLength({ min: 2 }),
    body('description').optional().trim(),
    body('parameters_schema').optional().isArray(),
    body('is_active').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { name, description, parameters_schema, is_active } = req.body;

      const existing = await executeQuery('SELECT id FROM asset_types WHERE id = ?', [id]);
      if (!existing.success || existing.data.length === 0) {
        return res.status(404).json({ error: 'Asset type not found' });
      }

      if (name) {
        const duplicate = await executeQuery('SELECT id FROM asset_types WHERE name = ? AND id != ?', [name, id]);
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
      if (parameters_schema !== undefined) {
        updates.push('parameters_schema = ?');
        params.push(JSON.stringify(parameters_schema));
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
        `UPDATE asset_types SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      if (!updateResult.success) {
        return res.status(500).json({ error: 'Failed to update asset type', message: updateResult.error });
      }

      const fetchResult = await executeQuery(
        'SELECT * FROM asset_types WHERE id = ?',
        [id]
      );

      res.json({ type: fetchResult.data[0] });
    } catch (error) {
      console.error('Update asset type error:', error);
      res.status(500).json({ error: 'Failed to update asset type', message: error.message });
    }
  }
);

// Delete an asset type
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery('SELECT id FROM asset_types WHERE id = ?', [id]);
    if (!existing.success || existing.data.length === 0) {
      return res.status(404).json({ error: 'Asset type not found' });
    }

    // Check if in use by assets
    const inUse = await executeQuery('SELECT COUNT(*) as count FROM assets WHERE type = ?', [id]);
    if (inUse.success && inUse.data[0].count > 0) {
       // Just fetch name to check
       const typeInfo = await executeQuery('SELECT name FROM asset_types WHERE id = ?', [id]);
       const typeName = typeInfo.success ? typeInfo.data[0].name : id;
       
       const inUseByName = await executeQuery('SELECT COUNT(*) as count FROM assets WHERE type = ?', [typeName]);
       if (inUseByName.success && inUseByName.data[0].count > 0) {
           return res.status(400).json({ error: 'Cannot delete asset type currently in use by assets' });
       }
    }

    const result = await executeQuery('DELETE FROM asset_types WHERE id = ?', [id]);
    if (!result.success) {
      return res.status(500).json({ error: 'Failed to delete asset type', message: result.error });
    }

    res.json({ message: 'Asset type deleted successfully' });
  } catch (error) {
    console.error('Delete asset type error:', error);
    res.status(500).json({ error: 'Failed to delete asset type', message: error.message });
  }
});

export default router;
