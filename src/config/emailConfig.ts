/**
 * Company palette (flat solid colours only).
 * Mirrors backend/utils/emailTheme.js - keep the two in sync.
 */
export const EMAIL_PALETTE = {
  navy: '#152F52', // Blue tint
  red: '#D90429',
  white: '#FFFFFF',
  gold: '#F7E7C6', // Golden brown
  orange: '#E59730',
  green: '#D9E021',
} as const;

export interface EmailThemeTokens {
  page: string;
  card: string;
  header: string;
  headerText: string;
  headerBorder: string;
  text: string;
  muted: string;
  border: string;
  heading: string;
  btnBg: string;
  btnText: string;
  calloutBg: string;
  calloutText: string;
  footerBg: string;
}

/** Light + dark email themes; the dark one is applied via prefers-color-scheme. */
export const EMAIL_THEME: { light: EmailThemeTokens; dark: EmailThemeTokens } = {
  light: {
    page: '#F6F8FB', card: '#FFFFFF', header: '#152F52', headerText: '#FFFFFF', headerBorder: '#152F52',
    text: '#22344F', muted: '#63758F', border: '#DCE3ED', heading: '#152F52',
    btnBg: '#D90429', btnText: '#FFFFFF', calloutBg: '#F7E7C6', calloutText: '#152F52', footerBg: '#F6F8FB',
  },
  dark: {
    page: '#0B1626', card: '#122238', header: '#0B1626', headerText: '#F7E7C6', headerBorder: '#D90429',
    text: '#DCE3ED', muted: '#8C9BB2', border: '#2E3F5A', heading: '#F7E7C6',
    btnBg: '#F7E7C6', btnText: '#152F52', calloutBg: '#1B2E4A', calloutText: '#F7E7C6', footerBg: '#0B1626',
  },
};

export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sender: {
    name: string;
    email: string;
  };
  templates: {
    defaultSubject: string;
    companyName: string;
    companyLogo?: string;
    primaryColor: string;
    secondaryColor: string;
  };
  preferences: {
    defaultEnabled: boolean;
    defaultTypes: string[];
    maxRetries: number;
    retryDelay: number;
  };
}

export const emailConfig: EmailConfig = {
  enabled: true,
  smtp: {
    host: import.meta.env.VITE_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(import.meta.env.VITE_SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: import.meta.env.VITE_SMTP_USERNAME || '',
      pass: import.meta.env.VITE_SMTP_PASSWORD || '',
    },
  },
  sender: {
    name: import.meta.env.VITE_SENDER_NAME || 'Caava Group',
    email: import.meta.env.VITE_SENDER_EMAIL || '',
  },
  templates: {
    defaultSubject: '[Caava Group]',
    companyName: 'Caava Group',
    companyLogo: "https://i.ibb.co/jZfnmhdg/logo.png",
    primaryColor: EMAIL_PALETTE.navy,
    secondaryColor: EMAIL_PALETTE.red,
  },
  preferences: {
    defaultEnabled: true,
    defaultTypes: ['success', 'error', 'warning', 'info'],
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
};

export const getEmailConfig = (): EmailConfig => {
  return emailConfig;
};

export const isEmailEnabled = (): boolean => {
  return emailConfig.enabled && 
         !!emailConfig.smtp.auth.user && 
         !!emailConfig.smtp.auth.pass && 
         !!emailConfig.sender.email;
};
