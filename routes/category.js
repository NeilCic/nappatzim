import express from 'express';
import { 
    getCategoriesController, 
    createCategoryController, 
    getCategoryByIdController, 
    updateCategoryController, 
    deleteCategoryController 
} from '../controllers/categoryController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.get('/', getCategoriesController);
router.post('/', createCategoryController);
router.get('/:id', getCategoryByIdController);
router.put('/:id', updateCategoryController);
router.delete('/:id', deleteCategoryController);

export default router;