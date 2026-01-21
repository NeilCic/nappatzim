import express from 'express';
import {
  createSessionController,
  endSessionController,
  addRouteController,
  getSessionsController,
  getSessionByIdController,
  getLoggedClimbIdsController,
  updateRouteController,
  updateRouteMetadataController,
  deleteSessionController,
  getInsightsController,
  getGradeProgressionController,
  getInsightsAndProgressionController,
} from '../controllers/sessionController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createSessionController);
router.get('/', getSessionsController);
router.get('/logged-climbs', getLoggedClimbIdsController);
router.get('/insights', getInsightsController);
router.get('/progression', getGradeProgressionController);
router.get('/overview', getInsightsAndProgressionController);
router.get('/:sessionId', getSessionByIdController);
router.put('/:sessionId/end', endSessionController);
router.post('/:sessionId/routes', addRouteController);
router.put('/routes/:routeId', updateRouteController);
router.put('/routes/:routeId/metadata', updateRouteMetadataController);
router.delete('/:sessionId', deleteSessionController);

export default router;
