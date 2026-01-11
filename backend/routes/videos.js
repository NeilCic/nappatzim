import express from 'express';
import {
  getVideoByIdController,
  updateVideoController,
  deleteVideoController,
} from '../controllers/layoutController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

// Individual video operations (top-level resource)
router.get('/:videoId', getVideoByIdController);
router.patch('/:videoId', updateVideoController); // Update metadata only (title, description)
router.delete('/:videoId', deleteVideoController);

export default router;
