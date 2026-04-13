const OUTPUT_SIZE_PX = 256;
const WEBP_QUALITY = 0.85;

export class AvatarUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarUploadError';
  }
}

export async function processAvatarToBase64(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new AvatarUploadError('Bild zu groß. Maximal 5 MB erlaubt.');
  }
  if (!file.type.startsWith('image/')) {
    throw new AvatarUploadError('Nur Bilddateien sind erlaubt.');
  }

  const bitmap = await createImageBitmap(file);

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE_PX;
  canvas.height = OUTPUT_SIZE_PX;
  const ctx = canvas.getContext('2d')!;

  // Mittig zuschneiden und auf 256×256 skalieren
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, OUTPUT_SIZE_PX, OUTPUT_SIZE_PX);
  bitmap.close();

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new AvatarUploadError('Bildkonvertierung fehlgeschlagen.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new AvatarUploadError('Bild konnte nicht gelesen werden.'));
        reader.readAsDataURL(blob);
      },
      'image/webp',
      WEBP_QUALITY,
    );
  });
}
