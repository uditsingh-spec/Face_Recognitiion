// New controller — add this content into server/src/controllers/babyController.ts
// (or as a new file server/src/controllers/faceMatchController.ts, then import
// matchFace and getFaceIndex into babyRoutes.ts).
import { Request, Response, NextFunction } from 'express';
import Baby from '../models/Baby';

const FACE_MATCH_THRESHOLD = 0.5;

// Simple, fast Euclidean distance between two 128-d embeddings.
// At hospital scale (hundreds-thousands of records) a brute-force scan
// is faster and simpler than any vector index — no extra infra needed.
const euclideanDistance = (a: number[], b: number[]): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] as number;
    const valB = b[i] as number;
    const diff = valA - valB;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

/**
 * POST /babies/match-face
 * Body: { embedding: number[] }
 * Compares the given embedding against every stored mother embedding in
 * the live database and returns the closest match, if any is within the
 * threshold. Used by the mobile app when it has an internet connection —
 * always authoritative since it sees every baby, not just what's cached
 * locally on one device.
 */
export const matchFace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { embedding } = req.body;
    if (!Array.isArray(embedding) || embedding.length !== 128) {
      res.status(400).json({ message: 'A valid 128-length embedding is required' });
      return;
    }

    const babies = await Baby.find({ motherFaceEmbedding: { $exists: true, $ne: [] } })
      .select('+motherFaceEmbedding motherName displayId motherImage')
      .lean();

    let matches: { babyId: string; motherName: string; displayId: string; distance: number; motherImage?: string }[] = [];
    
    for (const baby of babies) {
      if (!baby.motherFaceEmbedding || baby.motherFaceEmbedding.length !== 128) continue;
      const distance = euclideanDistance(embedding, baby.motherFaceEmbedding);
      if (distance < FACE_MATCH_THRESHOLD) {
        matches.push({
          babyId: String(baby._id),
          motherName: baby.motherName,
          displayId: baby.displayId,
          motherImage: baby.motherImage,
          distance,
        });
      }
    }

    // Sort by distance (closest match first)
    matches.sort((a, b) => a.distance - b.distance);

    if (matches.length > 0) {
      // Keep only top 10 to avoid huge payloads if many babies somehow match
      const topMatches = matches.slice(0, 10);
      res.json({ matched: true, matches: topMatches });
    } else {
      res.json({ matched: false, matches: [] });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /babies/face-index
 * Returns a lightweight list of {babyId, motherName, displayId, embedding}
 * for every baby that has a face scan. The mobile app downloads this once
 * on startup / reconnect and caches it locally in SQLite, so face matching
 * still works when the phone later has no internet.
 */
export const getFaceIndex = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const babies = await Baby.find({ motherFaceEmbedding: { $exists: true, $ne: [] } })
      .select('+motherFaceEmbedding motherName displayId motherImage')
      .lean();

    const index = babies
      .filter((b) => b.motherFaceEmbedding && b.motherFaceEmbedding.length === 128)
      .map((b) => ({
        babyId: String(b._id),
        motherName: b.motherName,
        displayId: b.displayId,
        motherImage: b.motherImage,
        embedding: b.motherFaceEmbedding,
      }));

    res.json(index);
  } catch (error) {
    next(error);
  }
};
