import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { getIdleTimeoutConfig, useIdleTimeout, IdleTimeoutReason } from '../../hooks/useIdleTimeout';
import SessionTimeoutModal from './SessionTimeoutModal';

/**
 * Renders nothing until the signed-in user has been idle long enough to warn,
 * then shows the countdown modal and finally signs the user out.
 * Mount once inside the authenticated layout (needs Router, Auth and
 * Notification providers).
 */
const IdleSessionWatcher: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const { timeoutMs, warningMs } = useMemo(getIdleTimeoutConfig, []);

  const handleTimeout = useCallback(
    async (reason: IdleTimeoutReason) => {
      addToast({
        title: 'Session expired',
        message: 'You were signed out because of inactivity. Please sign in again.',
        type: 'warning',
        duration: 8000,
      });
      // Another tab already signed out; AuthContext clears this tab via the
      // storage event, so just let the auth guard redirect.
      if (reason === 'remote') return;
      // Clears authToken/user (a stale JWT must not survive) and auth state.
      await logout();
      navigate('/login', { replace: true });
    },
    [addToast, logout, navigate],
  );

  const { isWarning, remainingSeconds, stayActive } = useIdleTimeout({
    timeoutMs,
    warningMs,
    onTimeout: handleTimeout,
    enabled: isAuthenticated,
  });

  const signOutNow = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <SessionTimeoutModal
      open={isWarning}
      remainingSeconds={remainingSeconds ?? 0}
      totalSeconds={Math.round(warningMs / 1000)}
      onStay={stayActive}
      onSignOut={signOutNow}
    />
  );
};

export default IdleSessionWatcher;
