import express from 'express';
import { 
    addWorkoutController, 
    getWorkoutController, 
    getWorkoutsByCategoryController,
    updateWorkoutController,
    deleteWorkoutController,
    hasPreviousWorkoutController
} from '../controllers/workoutController.js';
import { verifyToken } from '../middleware/auth.js'

const router = express.Router();

router.use(verifyToken);
router.get('/', getWorkoutController);
router.post('/', addWorkoutController);
router.get('/category/:categoryId', getWorkoutsByCategoryController);
router.get('/category/:categoryId/check-previous', hasPreviousWorkoutController);
router.put('/:workoutId', updateWorkoutController);
router.delete('/:workoutId', deleteWorkoutController);

export default router;