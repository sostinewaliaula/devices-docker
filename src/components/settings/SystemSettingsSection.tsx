import React, { useState, useEffect } from 'react';
import { settingsAPI, SystemSetting } from '../../services/apiService';
import { useNotifications } from '../../contexts/NotificationContext';
import {
    MailIcon,
    SaveIcon,
    RefreshCwIcon,
    ActivityIcon,
    ServerIcon,
    ShieldCheckIcon,
    EyeOffIcon,
    EyeIcon,
} from 'lucide-react';

const SystemSettingsSection: React.FC = () => {
    const { addToast } = useNotifications();
    const [settings, setSettings] = useState<SystemSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [showGoogleSecret, setShowGoogleSecret] = useState(false);

    const ensureSetting = (
        allSettings: SystemSetting[],
        setting_key: string,
        description: string,
        category: string,
        fallbackValue = ''
    ) => {
        if (allSettings.some(s => s.setting_key === setting_key)) {
            return allSettings;
        }

        return [
            ...allSettings,
            {
                setting_key,
                setting_value: fallbackValue,
                description,
                category
            }
        ];
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await settingsAPI.getSettings();
            const legacyLogo = data.find(s => s.setting_key === 'company_logo')?.setting_value || '';
            const withLogoVariants = [
                ['company_logo_light', 'Company Logo for Light Mode (Base64 or URL)'],
                ['company_logo_dark', 'Company Logo for Dark Mode (Base64 or URL)']
            ].reduce(
                (current, [key, description]) => ensureSetting(current, key, description, 'branding', legacyLogo),
                data
            );

            // Ensure Google OAuth rows are present in local state even if DB has them
            const withGoogle = [
                ['google_oauth_enabled',  'Enable Google sign-in (true/false)',                          'google_oauth', 'false'],
                ['google_client_id',      'Google OAuth Client ID',                                      'google_oauth', ''],
                ['google_client_secret',  'Google OAuth Client Secret',                                  'google_oauth', ''],
                ['google_allowed_domain', 'Comma-separated allowed domains (e.g. acme.com,corp.acme.com) – leave blank for any', 'google_oauth', ''],
            ].reduce(
                (current, [key, description, category, fallback]) =>
                    ensureSetting(current, key, description, category, fallback),
                withLogoVariants
            );

            setSettings(withGoogle);
        } catch (error: any) {
            console.error('Failed to fetch settings:', error);
            addToast({
                title: 'Error',
                message: 'Failed to load system settings',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setSettings(prev => prev.map(s =>
            s.setting_key === key ? { ...s, setting_value: value } : s
        ));
    };

    const getSettingValue = (key: string) => settings.find(s => s.setting_key === key)?.setting_value || '';

    const handleImageUpload = (key: string, file?: File) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            handleInputChange(key, reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const renderLogoUpload = (key: string, label: string, helperText: string, previewClassName = 'h-12') => (
        <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">{label}</label>
            <div className="flex items-center gap-4">
                {getSettingValue(key) && (
                    <img
                        src={getSettingValue(key)}
                        alt={`${label} Preview`}
                        className={`${previewClassName} w-auto object-contain border border-gray-200 dark:border-gray-700 rounded-lg p-1 bg-white`}
                    />
                )}
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(key, e.target.files?.[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">{helperText}</p>
        </div>
    );

    const handleSave = async (category: string) => {
        setSaving(true);
        try {
            const categorySettings = settings
                .filter(s => s.category === category)
                .map(s => ({ setting_key: s.setting_key, setting_value: s.setting_value }));

            await settingsAPI.updateSettings(categorySettings);

            if (category === 'branding') {
                // Force reload to update branding context globally
                window.location.reload();
            }

            addToast({
                title: 'Success',
                message: `${category.toUpperCase()} settings updated successfully`,
                type: 'success'
            });
        } catch (error: any) {
            console.error('Failed to update settings:', error);
            addToast({
                title: 'Error',
                message: 'Failed to update settings',
                type: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const testSmtpConnection = async () => {
        setTestingConnection(true);
        try {
            const result = await settingsAPI.testEmailSettings();
            addToast({
                title: 'SMTP Test',
                message: result.message || 'Connection test successful',
                type: 'success'
            });
        } catch (error: any) {
            console.error('SMTP Test failed:', error);
            addToast({
                title: 'SMTP Test Failed',
                message: error.response?.data?.details || 'Could not connect to SMTP server',
                type: 'error'
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const renderSettingInput = (setting: SystemSetting) => {
        const isPassword = setting.setting_key.includes('pass') || setting.setting_key.includes('secret');

        return (
            <div key={setting.setting_key} className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                    {setting.setting_key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </label>
                <input
                    type={isPassword ? 'password' : 'text'}
                    value={setting.setting_value}
                    onChange={(e) => handleInputChange(setting.setting_key, e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder={setting.description}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">{setting.description}</p>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
                <div className="w-8 h-8 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const smtpSettings = settings.filter(s => s.category === 'smtp');

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ServerIcon className="w-5 h-5 text-primary" />
                System Configuration
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SMTP Configuration */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-center space-x-3">
                            <MailIcon className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">SMTP Configuration</h2>
                        </div>
                        <button
                            onClick={testSmtpConnection}
                            disabled={testingConnection}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-primary bg-lightred rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {testingConnection ? (
                                <RefreshCwIcon className="w-3 h-3 mr-2 animate-spin" />
                            ) : (
                                <ActivityIcon className="w-3 h-3 mr-2" />
                            )}
                            Test
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {smtpSettings.map(renderSettingInput)}
                        </div>
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => handleSave('smtp')}
                                disabled={saving}
                                className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {saving ? (
                                    <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <SaveIcon className="w-4 h-4 mr-2" />
                                )}
                                Save SMTP Settings
                            </button>
                        </div>
                    </div>
                </div>

                {/* Google OAuth Configuration */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center space-x-3 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Google Sign-In</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Enable toggle */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Enable Google Sign-In</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Show the Google button on login and register pages.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleInputChange('google_oauth_enabled', getSettingValue('google_oauth_enabled') === 'true' ? 'false' : 'true')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${getSettingValue('google_oauth_enabled') === 'true' ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${getSettingValue('google_oauth_enabled') === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Client ID */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Client ID</label>
                            <input
                                type="text"
                                value={getSettingValue('google_client_id')}
                                onChange={(e) => handleInputChange('google_client_id', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs"
                                placeholder="xxxxxxxxxx-xxxx.apps.googleusercontent.com"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">From Google Cloud Console → APIs & Services → Credentials.</p>
                        </div>

                        {/* Client Secret */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Client Secret</label>
                            <div className="relative">
                                <input
                                    type={showGoogleSecret ? 'text' : 'password'}
                                    value={getSettingValue('google_client_secret')}
                                    onChange={(e) => handleInputChange('google_client_secret', e.target.value)}
                                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs"
                                    placeholder="GOCSPX-…"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowGoogleSecret(v => !v)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-primary"
                                >
                                    {showGoogleSecret ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Never shared publicly — stored securely in the database.</p>
                        </div>

                        {/* Allowed Domains */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Allowed Domains <span className="font-normal text-gray-400">(optional)</span></label>
                            <input
                                type="text"
                                value={getSettingValue('google_allowed_domain')}
                                onChange={(e) => handleInputChange('google_allowed_domain', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="e.g. acme.com, corp.acme.com"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Comma-separated. Only Google accounts from these domains will be accepted. Leave blank to allow any Google account.</p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => handleSave('google_oauth')}
                                disabled={saving}
                                className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {saving ? <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" /> : <SaveIcon className="w-4 h-4 mr-2" />}
                                Save Google Settings
                            </button>
                        </div>
                    </div>
                </div>

                {/* Branding Configuration */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center space-x-3 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <ActivityIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Branding</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Site Name */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Site Name</label>
                            <input
                                type="text"
                                value={getSettingValue('site_name')}
                                onChange={(e) => handleInputChange('site_name', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="e.g. Acme Corp Assets"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Application name displayed in login page and sidebar.</p>
                        </div>

                        {/* Browser Title */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Browser Tab Title</label>
                            <input
                                type="text"
                                value={getSettingValue('browser_title')}
                                onChange={(e) => handleInputChange('browser_title', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                placeholder="e.g. Acme Corp Assets Management"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Title shown in the browser tab.</p>
                        </div>

                        {/* Logo Uploads */}
                        {renderLogoUpload(
                            'company_logo_light',
                            'Company Logo (Light Mode)',
                            'Upload the logo shown on light backgrounds. It will be stored in the database.'
                        )}

                        {renderLogoUpload(
                            'company_logo_dark',
                            'Company Logo (Dark Mode)',
                            'Upload the logo shown on dark backgrounds. If empty, the light logo will be used.'
                        )}

                        {/* Favicon Upload */}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Favicon</label>
                            <div className="flex items-center gap-4">
                                {settings.find(s => s.setting_key === 'favicon')?.setting_value && (
                                    <img
                                        src={getSettingValue('favicon')}
                                        alt="Favicon Preview"
                                        className="h-8 w-8 object-contain border border-gray-200 rounded-lg p-1"
                                    />
                                )}
                                <input
                                    type="file"
                                    accept="image/x-icon,image/png"
                                    onChange={(e) => {
                                        handleImageUpload('favicon', e.target.files?.[0]);
                                    }}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-1">Upload a favicon (ICO/PNG).</p>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => handleSave('branding')}
                                disabled={saving}
                                className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {saving ? (
                                    <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <SaveIcon className="w-4 h-4 mr-2" />
                                )}
                                Save Branding
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Info / Status */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <ServerIcon className="w-5 h-5 text-secondary" />
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">System Information</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Environment</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                                    {import.meta.env.MODE}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Node Version</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">18.x / 20.x</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Database Type</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white">MySQL / MariaDB</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-6 border border-primary/10">
                        <div className="flex items-start space-x-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ShieldCheckIcon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Security Note</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    SMTP passwords and sensitive keys are encrypted at rest. Changes take effect almost immediately. Ensure your firewall allows outbound connections to the SMTP host.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsSection;
