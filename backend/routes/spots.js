import express from 'express';
import {
  getSpotByIdController,
  updateSpotController,
  deleteSpotController,
  resetSpotController,
} from '../controllers/layoutController.js';
import {
  getClimbsBySpotController,
  createClimbController,
} from '../controllers/climbController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/:spotId', getSpotByIdController);
router.put('/:spotId', updateSpotController);
router.delete('/:spotId', deleteSpotController);
router.post('/:spotId/reset', resetSpotController);

router.get('/:spotId/climbs', getClimbsBySpotController);
router.post('/:spotId/climbs', createClimbController);

export default router;
