import express from 'express';
import { body, validationResult } from 'express-validator';
import { executeQuery } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import emailService from '../services/emailService.js';

const router = express.Router();

const settingMetadata = {
    company_logo_light: {
        description: 'Company Logo for Light Mode (Base64 or URL)',
        category: 'branding'
    },
    company_logo_dark: {
        description: 'Company Logo for Dark Mode (Base64 or URL)',
        category: 'branding'
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied', message: 'Admin privileges required' });
    }
};

// Get Google OAuth public config (client_id + enabled flag) - No auth required
router.get('/google-oauth-config', async (req, res) => {
    try {
        const result = await executeQuery(
            "SELECT setting_key, setting_value FROM system_settings WHERE category = 'google_oauth'"
        );
        if (!result.success) throw new Error(result.error);
        const map = result.data.reduce((acc, r) => { acc[r.setting_key] = r.setting_value; return acc; }, {});
        // Only expose what the frontend needs — never leak the client secret
        res.json({
            enabled: map.google_oauth_enabled === 'true',
            clientId: map.google_client_id || '',
            allowedDomain: map.google_allowed_domain || '',
        });
    } catch (error) {
        console.error('Error fetching Google OAuth config:', error);
        res.status(500).json({ error: 'Failed to fetch Google OAuth config' });
    }
});

// Get public settings (branding) - No auth required
router.get('/public', async (req, res) => {
    try {
        const query = "SELECT setting_key, setting_value FROM system_settings WHERE category = 'branding'";
        const result = await executeQuery(query);

        if (!result.success) throw new Error(result.error);

        // Convert array to object
        const settings = result.data.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {});

        res.json(settings);
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({ error: 'Failed to fetch public settings' });
    }
});

// Get all settings
router.get('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT setting_key, setting_value, description, category, updated_at FROM system_settings';
        const params = [];

        if (category) {
            // Validate category to prevent arbitrary queries if needed, though parameterized query is safe
            query += ' WHERE category = ?';
            params.push(category);
        }

        const result = await executeQuery(query, params);
        if (!result.success) throw new Error(result.error);

        res.json(result.data);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.put('/', authenticateToken, isAdmin, [
    body('settings').isArray().withMessage('Settings must be an array'),
    body('settings.*.setting_key').notEmpty(),
    body('settings.*.setting_value').exists()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { settings } = req.body;

        for (const setting of settings) {
            const { setting_key, setting_value } = setting;
            const metadata = settingMetadata[setting_key] || {};
            await executeQuery(
                `INSERT INTO system_settings (setting_key, setting_value, description, category)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [
                    setting_key,
                    setting_value,
                    metadata.description || setting.description || '',
                    metadata.category || setting.category || 'general'
                ]
            );
        }

        // Reinitalize email transporter if SMTP settings changed
        const hasSmtpChanges = settings.some(s => s.setting_key.startsWith('smtp_'));
        if (hasSmtpChanges) {
            console.log('Reinitalizing email transporter due to settings update');
            await emailService.initializeTransporter(true); // Force re-init
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Test SMTP connection
router.post('/test-email', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await emailService.testConnection();
        if (result.success) {
            res.json({ message: 'SMTP connection test successful' });
        } else {
            res.status(500).json({ error: 'SMTP connection failed', details: result.error });
        }
    } catch (error) {
        console.error('SMTP test error:', error);
        res.status(500).json({ error: 'An unexpected error occurred during SMTP test' });
    }
});

export default router;
