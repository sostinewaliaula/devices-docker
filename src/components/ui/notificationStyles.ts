// Single source of truth for how notification types map onto the company palette,
// shared by the toast, the header dropdown, the bell dropdown and the notifications page.
//   success → Green   warning → Orange   error → Red   info/other → Blue Tint (Golden brown in dark)
// Chips are solid so the icon keeps contrast in both themes (navy icon on lime/orange, white on red/navy).

export interface NotificationTypeStyle {
  /** Solid icon chip (background + icon colour) */
  chip: string;
  /** Left accent bar colour */
  bar: string;
  /** Small pill used for the type label */
  pill: string;
}

const STYLES: Record<string, NotificationTypeStyle> = {
  success: {
    chip: 'bg-brand-green text-secondary',
    bar: 'border-brand-green',
    pill: 'bg-brand-green/30 text-secondary dark:bg-brand-green/20 dark:text-brand-green',
  },
  warning: {
    chip: 'bg-brand-orange text-secondary',
    bar: 'border-brand-orange',
    pill: 'bg-brand-orange/20 text-secondary dark:bg-brand-orange/20 dark:text-brand-orange',
  },
  error: {
    chip: 'bg-primary text-white',
    bar: 'border-primary',
    pill: 'bg-primary/10 text-primary dark:bg-primary/25 dark:text-heading',
  },
  info: {
    chip: 'bg-secondary text-white dark:bg-accent dark:text-secondary',
    bar: 'border-secondary dark:border-accent',
    pill: 'bg-secondary/10 text-secondary dark:bg-accent/15 dark:text-accent',
  },
};

export const notificationTypeStyle = (type?: string): NotificationTypeStyle =>
  STYLES[type ?? 'info'] ?? STYLES.info;
