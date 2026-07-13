import express from 'express';
import { createBaby, getBabies, getBabyById, getBabySamples, createSample, deleteBaby, updateBaby } from '../controllers/babyController';
import { matchFace, getFaceIndex } from '../controllers/faceMatchController';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

const router = express.Router();

router.route('/')
  .post(authMiddleware, upload.single('motherImage'), createBaby)
  .get(authMiddleware, getBabies);

router.post('/match-face', authMiddleware, matchFace);
router.get('/face-index', authMiddleware, getFaceIndex);

router.route('/:id')
  .get(authMiddleware, getBabyById)
  .put(authMiddleware, upload.single('motherImage'), updateBaby)
  .delete(authMiddleware, adminMiddleware, deleteBaby);

router.route('/:id/samples')
  .get(authMiddleware, getBabySamples)
  .post(authMiddleware, createSample);

export default router;
