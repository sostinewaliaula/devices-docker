import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsAPI } from '../services/apiService';
import Logo from '../assets/logo.png'; // Fallback

type AppliedTheme = 'light' | 'dark';

interface BrandingContextType {
    siteName: string;
    browserTitle: string;
    logoUrl: string;
    faviconUrl: string;
    refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
    const context = useContext(BrandingContext);
    if (!context) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }
    return context;
};

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [siteName, setSiteName] = useState('Caava Assets');
    const [browserTitle, setBrowserTitle] = useState('Caava Assets Management');
    const [logoUrl, setLogoUrl] = useState(Logo as unknown as string);
    const [lightLogoUrl, setLightLogoUrl] = useState('');
    const [darkLogoUrl, setDarkLogoUrl] = useState('');
    const [faviconUrl, setFaviconUrl] = useState('/favicon.ico');
    const [appliedTheme, setAppliedTheme] = useState<AppliedTheme>(() =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );

    const refreshBranding = async () => {
        try {
            const settings = await settingsAPI.getPublicSettings();

            if (settings.site_name) {
                setSiteName(settings.site_name);
            }

            // Use browser_title if available, otherwise fallback to site_name
            const title = settings.browser_title || settings.site_name;
            if (title) {
                setBrowserTitle(title);
                document.title = title;
            }

            if (settings.company_logo) {
                setLogoUrl(settings.company_logo);
            }

            setLightLogoUrl(settings.company_logo_light || settings.company_logo || '');
            setDarkLogoUrl(settings.company_logo_dark || settings.company_logo || '');

            if (settings.favicon) {
                setFaviconUrl(settings.favicon);
                updateFavicon(settings.favicon);
            }
        } catch (error) {
            console.error('Failed to load branding settings:', error);
        }
    };

    const updateFavicon = (url: string) => {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = url;
    };

    useEffect(() => {
        refreshBranding();
    }, []);

    useEffect(() => {
        const syncAppliedTheme = () => {
            setAppliedTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        };

        syncAppliedTheme();

        const observer = new MutationObserver(syncAppliedTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    const activeLogoUrl = appliedTheme === 'dark'
        ? darkLogoUrl || lightLogoUrl || logoUrl
        : lightLogoUrl || darkLogoUrl || logoUrl;

    return (
        <BrandingContext.Provider value={{ siteName, browserTitle, logoUrl: activeLogoUrl, faviconUrl, refreshBranding }}>
            {children}
        </BrandingContext.Provider>
    );
};
