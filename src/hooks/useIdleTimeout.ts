import { useCallback, useEffect, useRef, useState } from 'react';

/** Shared (cross-tab) timestamp of the last user activity, in epoch ms. */
export const LAST_ACTIVITY_KEY = 'assets:lastActivity';
/** Written by the tab that timed out so that other tabs can react immediately. */
export const IDLE_LOGOUT_KEY = 'assets:idleLogout';

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_WARNING_SECONDS = 60;
const ACTIVITY_THROTTLE_MS = 1000;
const TICK_MS = 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
];

export type IdleTimeoutReason = 'idle' | 'remote';

export interface IdleTimeoutConfig {
  /** Total inactivity before sign-out, in ms. 0 = feature disabled. */
  timeoutMs: number;
  /** How long before sign-out the warning is shown, in ms. 0 = no warning. */
  warningMs: number;
}

const readNonNegative = (raw: unknown, fallback: number): number => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Reads VITE_IDLE_TIMEOUT_MINUTES (default 30, 0 disables) and
 * VITE_IDLE_WARNING_SECONDS (default 60, 0 = sign out without a warning).
 */
export const getIdleTimeoutConfig = (): IdleTimeoutConfig => {
  const minutes = readNonNegative(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES);
  const warningSeconds = readNonNegative(import.meta.env.VITE_IDLE_WARNING_SECONDS, DEFAULT_WARNING_SECONDS);
  const timeoutMs = Math.round(minutes * 60_000);
  const warningMs = Math.min(Math.round(warningSeconds * 1000), timeoutMs);
  return { timeoutMs, warningMs };
};

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / quota) - the in-memory value still works */
  }
};

/** Decodes the `iat` claim (ms) of the stored JWT, or null if unavailable. */
const getTokenIssuedAtMs = (): number | null => {
  try {
    const token = safeGet('authToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.iat === 'number' ? payload.iat * 1000 : null;
  } catch {
    return null;
  }
};

export interface UseIdleTimeoutOptions {
  timeoutMs: number;
  warningMs: number;
  /**
   * Called once when the session times out. `'idle'` means this tab detected the
   * timeout and is responsible for signing out; `'remote'` means another tab
   * already did. May be async.
   */
  onTimeout: (reason: IdleTimeoutReason) => void | Promise<void>;
  enabled: boolean;
}

export interface UseIdleTimeoutResult {
  /** True while the "you are about to be signed out" warning should be visible. */
  isWarning: boolean;
  /** Whole seconds until sign-out while warning, otherwise null. */
  remainingSeconds: number | null;
  /** Explicitly extends the session (the "Stay signed in" action). */
  stayActive: () => void;
}

export function useIdleTimeout({
  timeoutMs,
  warningMs,
  onTimeout,
  enabled,
}: UseIdleTimeoutOptions): UseIdleTimeoutResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const warningRef = useRef(false);
  const firedRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef(0);

  const active = enabled && timeoutMs > 0;

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastWriteRef.current = now;
    safeSet(LAST_ACTIVITY_KEY, String(now));
  }, []);

  const stayActive = useCallback(() => {
    if (firedRef.current) return;
    recordActivity();
    warningRef.current = false;
    setRemainingSeconds(null);
  }, [recordActivity]);

  useEffect(() => {
    if (!active) {
      warningRef.current = false;
      setRemainingSeconds(null);
      return;
    }

    firedRef.current = false;
    const effectiveWarningMs = Math.min(warningMs, timeoutMs);

    // Establish the baseline. A fresh login (JWT issued after the stored
    // timestamp) or a missing timestamp starts a new idle window; otherwise a
    // stale timestamp (browser reopened hours later with a still-valid 7d JWT)
    // is honoured so the session times out straight away.
    const stored = Number(safeGet(LAST_ACTIVITY_KEY));
    const issuedAt = getTokenIssuedAtMs();
    if (!Number.isFinite(stored) || stored <= 0 || (issuedAt !== null && issuedAt > stored)) {
      recordActivity();
    } else {
      lastActivityRef.current = Math.min(stored, Date.now());
    }

    const getLastActivity = (): number => {
      const now = Date.now();
      const stored = Number(safeGet(LAST_ACTIVITY_KEY));
      const shared = Number.isFinite(stored) && stored > 0 ? stored : 0;
      // Never trust a timestamp from the future (clock changes).
      return Math.min(now, Math.max(shared, lastActivityRef.current));
    };

    let interval: ReturnType<typeof setInterval> | undefined;

    const fireTimeout = async (reason: IdleTimeoutReason) => {
      if (firedRef.current) return;
      firedRef.current = true;
      warningRef.current = false;
      setRemainingSeconds(null);
      if (interval) clearInterval(interval);
      if (reason === 'idle') {
        // Tell other tabs first so they can show a message; their auth state is
        // cleared through the authToken removal performed by logout.
        safeSet(IDLE_LOGOUT_KEY, String(Date.now()));
      }
      try {
        await onTimeoutRef.current(reason);
      } catch (error) {
        console.error('Idle timeout handler failed:', error);
      }
    };

    const tick = () => {
      if (firedRef.current) return;
      const idle = Math.max(0, Date.now() - getLastActivity());

      if (idle >= timeoutMs) {
        void fireTimeout('idle');
        return;
      }

      if (effectiveWarningMs > 0 && idle >= timeoutMs - effectiveWarningMs) {
        warningRef.current = true;
        const secs = Math.max(1, Math.ceil((timeoutMs - idle) / 1000));
        setRemainingSeconds((prev) => (prev === secs ? prev : secs));
      } else if (warningRef.current) {
        // Activity in another tab dismissed the warning.
        warningRef.current = false;
        setRemainingSeconds(null);
      }
    };

    const onActivity = () => {
      // While the warning is showing only the explicit "Stay signed in" action
      // may extend the session; stray mouse moves must not dismiss it.
      if (warningRef.current || firedRef.current) return;
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      recordActivity();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === IDLE_LOGOUT_KEY && e.newValue) {
        void fireTimeout('remote');
      } else if (e.key === LAST_ACTIVITY_KEY) {
        tick();
      }
    };

    // Timers are throttled/suspended in background tabs and during sleep, so
    // re-evaluate against the wall clock whenever the page comes back.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true, capture: true }),
    );
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    document.addEventListener('visibilitychange', onVisibility);

    interval = setInterval(tick, TICK_MS);
    tick();

    return () => {
      if (interval) clearInterval(interval);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onActivity, { capture: true }),
      );
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, timeoutMs, warningMs, recordActivity]);

  return {
    isWarning: remainingSeconds !== null,
    remainingSeconds,
    stayActive,
  };
}

export default useIdleTimeout;
