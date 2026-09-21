// User avatar storage. Images live in the `users` table itself (avatar_data /
// avatar_type / avatar_source / avatar_updated_at), following the same
// "images in the DB" approach used for assets, so avatars are backed up with
// everything else and can be replaced from anywhere in the system.
import { executeQuery } from '../config/database.js';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB — the client resizes to ~256px, so real files are far smaller
const GOOGLE_FETCH_TIMEOUT_MS = 5000;

// Identify the image by its magic bytes instead of trusting the client's
// Content-Type. SVG is deliberately not allowed (script injection risk).
export function sniffImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/** source: 'google' | 'upload' */
export async function saveAvatar(userId, buffer, type, source) {
  return executeQuery(
    `UPDATE users
        SET avatar_data = ?, avatar_type = ?, avatar_source = ?, avatar_updated_at = NOW()
      WHERE id = ?`,
    [buffer, type, source, userId]
  );
}

/** Removes the stored image. Marked 'none' so a later Google sign-in doesn't silently bring it back. */
export async function clearAvatar(userId) {
  return executeQuery(
    `UPDATE users
        SET avatar_data = NULL, avatar_type = NULL, avatar_source = 'none', avatar_updated_at = NULL
      WHERE id = ?`,
    [userId]
  );
}

// Google serves profile photos from *.googleusercontent.com; refuse anything
// else so this can't be turned into a server-side request to an arbitrary host.
function isAllowedGooglePhotoUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'googleusercontent.com' || u.hostname.endsWith('.googleusercontent.com'));
  } catch {
    return false;
  }
}

/** Downloads the Google profile photo (256px). Returns { buffer, type } or null on any failure. */
export async function fetchGooglePhoto(pictureUrl) {
  if (!pictureUrl || !isAllowedGooglePhotoUrl(pictureUrl)) return null;
  // Google's default is ~96px; ask for 256px (the "=s96-c" suffix controls size).
  const url = pictureUrl.replace(/=s\d+(-c)?$/, '=s256-c');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const declared = Number(resp.headers.get('content-length') || 0);
    if (declared > MAX_AVATAR_BYTES) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > MAX_AVATAR_BYTES) return null;
    const type = sniffImageType(buffer);
    return type ? { buffer, type } : null;
  } catch (err) {
    console.warn('Google avatar fetch failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Called on Google sign-in. Copies the user's Google photo into the DB unless
 * they've uploaded their own ('upload') or deliberately removed it ('none').
 * Never throws — a failed photo must not block sign-in.
 */
export async function syncGoogleAvatar(userId, pictureUrl, currentSource) {
  try {
    if (currentSource === 'upload' || currentSource === 'none') return;
    const photo = await fetchGooglePhoto(pictureUrl);
    if (photo) await saveAvatar(userId, photo.buffer, photo.type, 'google');
  } catch (err) {
    console.warn('Google avatar sync failed:', err.message);
  }
}
