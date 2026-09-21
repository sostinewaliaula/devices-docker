import React from 'react';
import ThemeToggle from '../ui/ThemeToggle';
import { useBranding } from '../../contexts/BrandingContext';

/**
 * Shared class strings for the auth flow, so every screen uses the same
 * palette-driven look (navy/golden action button, surface-2 inputs, etc).
 */
export const authStyles = {
  label: 'block text-sm font-medium text-heading',
  input:
    'block w-full py-3 text-sm bg-surface-2 border border-line text-content placeholder:text-muted rounded-xl ' +
    'focus:outline-none focus:ring-2 focus:ring-secondary/40 dark:focus:ring-accent/40 ' +
    'focus:border-secondary dark:focus:border-accent transition-colors disabled:opacity-60',
  // `!` beats the unlayered .button-action padding / pill radius in index.css
  button:
    'button-action flex items-center justify-center w-full !rounded-xl !px-4 !py-3 text-sm ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  buttonOutline:
    'flex items-center justify-center w-full px-4 py-3 text-sm font-semibold text-heading bg-surface ' +
    'border border-line rounded-xl hover:border-primary hover:bg-surface-2 transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  link: 'font-medium text-secondary dark:text-accent hover:text-primary hover:underline transition-colors',
  iconInInput: 'w-5 h-5 text-muted',
} as const;

type AlertTone = 'error' | 'warning' | 'success' | 'info';

const alertTones: Record<AlertTone, string> = {
  error: 'bg-lightred border-primary/30 text-primary dark:text-heading',
  warning: 'bg-brand-orange/10 border-brand-orange/40 text-content',
  success: 'bg-brand-green/20 border-brand-green/50 text-secondary dark:text-heading',
  info: 'bg-lightblue border-line text-content',
};

/** Tinted status panel used for errors, warnings and confirmations. */
export const AuthAlert: React.FC<{ tone?: AlertTone; children: React.ReactNode; className?: string }> = ({
  tone = 'error',
  children,
  className = '',
}) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`px-4 py-3 text-sm border rounded-xl ${alertTones[tone]} ${className}`}
  >
    {children}
  </div>
);

/** "or continue with" style divider. */
export const AuthDivider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-line" />
    </div>
    <div className="relative flex justify-center text-xs uppercase tracking-wide">
      <span className="px-3 bg-surface text-muted">{children}</span>
    </div>
  </div>
);

/** Round icon badge shown above the heading on status screens. */
export const AuthBadge: React.FC<{ tone?: 'success' | 'error' | 'brand' | 'warning'; children: React.ReactNode }> = ({
  tone = 'brand',
  children,
}) => {
  const tones = {
    success: 'bg-brand-green text-secondary',
    error: 'bg-lightred text-primary',
    warning: 'bg-brand-orange/20 text-brand-orange',
    brand: 'bg-surface-2 text-secondary dark:text-accent',
  } as const;
  return (
    <div className={`flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full ${tones[tone]}`}>
      {children}
    </div>
  );
};

/**
 * Password requirement list with a strength meter.
 * Meter segments are orange while requirements are outstanding and turn green once all are met.
 */
export const PasswordRequirements: React.FC<{ items: { label: string; met: boolean }[]; className?: string }> = ({
  items,
  className = '',
}) => {
  const metCount = items.filter(i => i.met).length;
  const complete = metCount === items.length;
  return (
    <div className={className}>
      <div className="flex gap-1 mb-3" aria-hidden="true">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              idx < metCount ? (complete ? 'bg-brand-green' : 'bg-brand-orange') : 'bg-line'
            }`}
          />
        ))}
      </div>
      <ul className="space-y-1.5 text-xs">
        {items.map(item => (
          <li key={item.label} className={`flex items-center gap-2 ${item.met ? 'text-heading' : 'text-muted'}`}>
            <span
              className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] leading-none font-bold ${
                item.met ? 'bg-brand-green text-secondary' : 'border border-line'
              }`}
              aria-hidden="true"
            >
              {item.met ? '✓' : ''}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const AuthSpinner: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <div
    className={`border-4 rounded-full animate-spin border-secondary/30 border-t-secondary dark:border-accent/30 dark:border-t-accent ${className}`}
    aria-hidden="true"
  />
);

interface AuthLayoutProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Rendered below the card body, separated by a divider (e.g. "Don't have an account? Sign up"). */
  footer?: React.ReactNode;
  /** Optional element between the brand and the title (e.g. a status icon badge). */
  icon?: React.ReactNode;
  /** Card width; wider variant is for multi-field forms such as registration. */
  size?: 'md' | 'lg';
  /** Hide the brand logo/name block (used for compact status screens). */
  hideBrand?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footer,
  icon,
  size = 'md',
  hideBrand = false,
}) => {
  const { logoUrl, siteName } = useBranding();

  const parts = (siteName || 'Caava Group').split(' ');
  const siteNameFirst = parts[0];
  const siteNameRest = parts.slice(1).join(' ');

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 py-16 bg-page">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div
        className={`w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'} p-6 sm:p-10 bg-surface border border-line rounded-2xl shadow-card`}
      >
        {!hideBrand && (
          <div className="flex flex-col items-center mb-6">
            <img src={logoUrl} alt={siteName} className="w-auto h-12 mb-2 icon-primary" />
            <div className="flex items-center text-xl font-bold">
              <span className="text-heading">{siteNameFirst}</span>
              {siteNameRest && <span className="ml-2 text-primary">{siteNameRest}</span>}
            </div>
          </div>
        )}

        {icon}

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-heading">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="pt-6 mt-8 text-sm text-center border-t border-line text-muted">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthLayout;
