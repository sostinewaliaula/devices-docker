import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SessionTimeoutModalProps {
  open: boolean;
  /** Whole seconds left before automatic sign-out. */
  remainingSeconds: number;
  /** Length of the warning window in seconds (drives the progress bar). */
  totalSeconds: number;
  onStay: () => void;
  onSignOut: () => void;
}

const formatCountdown = (seconds: number): string => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Screen readers get a polite update at a few milestones instead of every second.
const ANNOUNCE_AT = new Set([60, 45, 30, 20, 10, 5]);

const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  open,
  remainingSeconds,
  totalSeconds,
  onStay,
  onSignOut,
}) => {
  const titleId = useId();
  const descId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Escape = keep working; Tab is trapped between the two buttons.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStay();
      } else if (e.key === 'Tab') {
        const first = stayRef.current;
        const last = signOutRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!first.contains(document.activeElement) && !last.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onStay]);

  if (!open) return null;

  const percent = totalSeconds > 0 ? Math.min(100, Math.max(0, (remainingSeconds / totalSeconds) * 100)) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-secondary/60">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md p-6 bg-surface border border-line rounded-2xl shadow-card"
      >
        <h2 id={titleId} className="text-lg font-semibold text-heading">
          Are you still there?
        </h2>
        <p id={descId} className="mt-2 text-sm text-content">
          You have been inactive for a while. For your security you will be signed out automatically.
        </p>

        <p className="mt-4 text-sm text-muted" aria-hidden="true">
          You will be signed out in{' '}
          <span className="font-semibold tabular-nums text-primary">{formatCountdown(remainingSeconds)}</span>
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand-orange transition-[width] duration-1000 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {ANNOUNCE_AT.has(remainingSeconds)
            ? `You will be signed out in ${formatCountdown(remainingSeconds)}`
            : ''}
        </span>

        <div className="flex flex-col-reverse gap-3 mt-6 sm:flex-row sm:justify-end">
          <button
            ref={signOutRef}
            type="button"
            onClick={onSignOut}
            className="px-6 py-3 text-sm font-semibold transition-colors border rounded-full border-line text-content hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          >
            Sign out now
          </button>
          <button
            ref={stayRef}
            type="button"
            onClick={onStay}
            className="button-action focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SessionTimeoutModal;
