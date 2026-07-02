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
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
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
