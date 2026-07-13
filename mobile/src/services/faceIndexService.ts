// Local offline "face directory" — a lightweight cache of {babyId, name,
// displayId, embedding} used to identify a mother by face when the phone
// has no internet connection. Backed by the existing SQLite `cache` table
// (single JSON blob) so no schema migration is needed.
import { getDB } from './db';
import { compareFaceEmbeddings, FACE_MATCH_THRESHOLD } from './faceService';
import api from './api';

const CACHE_KEY = 'face_index';

export interface FaceIndexEntry {
  babyId: string;
  motherName: string;
  displayId: string;
  motherImage?: string;
  embedding: number[];
}

const readIndex = async (): Promise<FaceIndexEntry[]> => {
  try {
    const db = getDB();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM cache WHERE key = ?',
      [CACHE_KEY]
    );
    return row ? JSON.parse(row.data) : [];
  } catch {
    return [];
  }
};

const writeIndex = async (entries: FaceIndexEntry[]) => {
  const db = getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO cache (key, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [CACHE_KEY, JSON.stringify(entries)]
  );
};

/**
 * Adds or updates a single entry in the local face directory. Call this
 * right after a baby with a face scan is created/updated, online or
 * offline — this is what makes offline matching work later.
 */
export const upsertFaceIndexEntry = async (entry: FaceIndexEntry) => {
  const current = await readIndex();
  const filtered = current.filter((e) => e.babyId !== entry.babyId);
  filtered.push(entry);
  await writeIndex(filtered);
};

/**
 * Replaces a temporary offline-created ID with the real server-assigned
 * ID once the sync queue successfully uploads that record.
 */
export const renameFaceIndexEntry = async (tempId: string, realId: string, newDisplayId?: string, newImage?: string) => {
  const current = await readIndex();
  const updated = current.map((e) => {
    if (e.babyId === tempId) {
      return { 
        ...e, 
        babyId: realId, 
        displayId: newDisplayId || e.displayId,
        motherImage: newImage || e.motherImage 
      };
    }
    return e;
  });
  await writeIndex(updated);
};

/**
 * Pulls the full, authoritative face directory from the server. Call this
 * on app startup and whenever connectivity returns, so the local cache
 * stays fresh for the next time the phone goes offline.
 */
export const refreshFaceIndexFromServer = async (): Promise<void> => {
  try {
    const { data } = await api.get('/babies/face-index');
    if (Array.isArray(data)) {
      await writeIndex(data);
    }
  } catch (e) {
    console.log('Face index refresh skipped (offline or error):', (e as any)?.message);
  }
};

/**
 * Searches the local cache for the closest matching face. O(n) linear
 * scan over 128-d vectors — instant even for thousands of records.
 * Returns null if nothing is within the match threshold.
 */
export const findMatchLocally = async (
  embedding: number[]
): Promise<{ entry: FaceIndexEntry; distance: number }[]> => {
  const index = await readIndex();
  let matches: { entry: FaceIndexEntry; distance: number }[] = [];

  for (const entry of index) {
    const distance = compareFaceEmbeddings(embedding, entry.embedding);
    if (distance < FACE_MATCH_THRESHOLD) {
      matches.push({ entry, distance });
    }
  }
  
  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, 10);
};
