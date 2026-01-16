import express from 'express';
import {
  createSessionController,
  endSessionController,
  addRouteAttemptController,
  getSessionsController,
  getSessionByIdController,
  updateAttemptMetadataController,
  deleteSessionController,
} from '../controllers/sessionController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createSessionController);
router.get('/', getSessionsController);
router.get('/:sessionId', getSessionByIdController);
router.put('/:sessionId/end', endSessionController);
router.post('/:sessionId/attempts', addRouteAttemptController);
router.put('/attempts/:attemptId/metadata', updateAttemptMetadataController);
router.delete('/:sessionId', deleteSessionController);

export default router;
