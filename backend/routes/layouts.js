import express from 'express';
import multer from 'multer';
import {
  getAllLayoutsController,
  getLayoutByIdController,
  createLayoutController,
  updateLayoutController,
  deleteLayoutController,
  getSpotsByLayoutController,
  createSpotController,
  compareLayoutsWithCloudinaryController,
} from '../controllers/layoutController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage (we'll upload directly to Cloudinary)
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for layout images
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

router.use(verifyToken);

router.get('/', getAllLayoutsController);
router.get('/:layoutId', getLayoutByIdController);
router.post('/', uploadImage.single('layoutImage'), createLayoutController);
router.put('/:layoutId', uploadImage.single('layoutImage'), updateLayoutController);
router.delete('/:layoutId', deleteLayoutController);

router.get('/:layoutId/spots', getSpotsByLayoutController); // GET list of spots for layout
router.post('/:layoutId/spots', createSpotController); // POST create spot at layout

// Admin/health check endpoint - todo this should be something for an admin. for now it's unused but important to remember it's a thing that should be checked sometime/somehow
router.get('/compare/cloudinary', compareLayoutsWithCloudinaryController);

export default router;

