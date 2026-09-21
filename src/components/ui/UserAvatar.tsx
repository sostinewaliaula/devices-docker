import React, { useEffect, useState } from 'react';
import { usersAPI } from '../../services/apiService';

// One fetch per user+version for the whole session. `version` is the user's
// avatar_updated_at, so uploading/removing a photo changes the key and every
// avatar on screen refreshes; unchanged photos are never re-downloaded.
const urlCache = new Map<string, Promise<string | null>>();

const loadAvatarUrl = (userId: string, version: string): Promise<string | null> => {
  const key = `${userId}:${version}`;
  let pending = urlCache.get(key);
  if (!pending) {
    pending = usersAPI
      .getAvatarBlob(userId)
      .then(blob => URL.createObjectURL(blob))
      .catch(() => {
        urlCache.delete(key); // allow a retry next time instead of caching the failure
        return null;
      });
    urlCache.set(key, pending);
  }
  return pending;
};

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
} as const;

const initialsOf = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

interface UserAvatarProps {
  userId?: string | null;
  name?: string | null;
  /** The user's avatar_updated_at. Falsy means "no photo" and skips the request entirely. */
  version?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ userId, name, version, size = 'md', className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    if (userId && version) {
      loadAvatarUrl(userId, String(version)).then(url => {
        if (!cancelled) setSrc(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  const base = `inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none ${SIZES[size]} ${className}`;

  if (src) {
    return <img src={src} alt={name ? `${name}'s photo` : 'User photo'} className={`${base} object-cover`} draggable={false} />;
  }

  return (
    <span
      className={`${base} font-semibold bg-secondary text-white dark:bg-accent dark:text-secondary`}
      aria-label={name || 'User'}
      role="img"
    >
      {initialsOf(name)}
    </span>
  );
};

export default UserAvatar;
