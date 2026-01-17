import express from 'express';
import {
  createSessionController,
  endSessionController,
  addRouteAttemptController,
  getSessionsController,
  getSessionByIdController,
  updateRouteController,
  updateRouteMetadataController,
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
router.put('/routes/:routeId', updateRouteController);
router.put('/routes/:routeId/metadata', updateRouteMetadataController);
router.delete('/:sessionId', deleteSessionController);

export default router;
