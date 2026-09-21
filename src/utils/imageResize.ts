// Client-side avatar prep: centre-crop to a square and downscale, so what we
// send (and store in the DB) is a small ~256px image rather than a 12 MP photo.

export const AVATAR_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;

export async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  if (!AVATAR_INPUT_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG or WebP image.');
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new Error('That image is too large. Please choose one under 10 MB.');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That file could not be read as an image.');
  });

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the image.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  // WebP is smallest; fall back to JPEG where the browser can't encode it.
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
  if (blob && blob.type === 'image/webp') return blob;
  const jpeg: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!jpeg) throw new Error('Could not prepare the image.');
  return jpeg;
}
