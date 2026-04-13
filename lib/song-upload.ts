import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const MAX_SIZE_MB = 20;

export class SongUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SongUploadError';
  }
}

export async function uploadSong(
  file: File,
  playerId: string,
  oldSongUrl?: string,
): Promise<string> {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new SongUploadError(`Datei zu groß. Maximal ${MAX_SIZE_MB} MB erlaubt.`);
  }

  if (!file.type.startsWith('audio/')) {
    throw new SongUploadError('Nur Audiodateien (.mp3) sind erlaubt.');
  }

  // Alten Song löschen (best-effort)
  if (oldSongUrl) {
    try {
      await deleteObject(ref(storage, oldSongUrl));
    } catch {
      // Ignorieren — Datei könnte bereits gelöscht sein
    }
  }

  const storageRef = ref(storage, `songs/${playerId}.mp3`);
  await uploadBytes(storageRef, file, { contentType: 'audio/mpeg' });
  return getDownloadURL(storageRef);
}
