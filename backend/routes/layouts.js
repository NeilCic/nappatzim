import express from 'express';
import multer from 'multer';
import {
  getAllLayoutsController,
  getLayoutByIdController,
  createLayoutController,
  updateLayoutController,
  deleteLayoutController,
  getSpotsByLayoutController,
  getSpotByIdController,
  createSpotController,
  updateSpotController,
  deleteSpotController,
  getVideosBySpotController,
  getVideoByIdController,
  createVideoController,
  updateVideoController,
  deleteVideoController,
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

// Multer config for videos
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Accept videos only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  },
});

router.use(verifyToken);

router.get('/', getAllLayoutsController);
router.get('/:layoutId', getLayoutByIdController);
router.post('/', uploadImage.single('layoutImage'), createLayoutController);
router.put('/:layoutId', uploadImage.single('layoutImage'), updateLayoutController);
router.delete('/:layoutId', deleteLayoutController);

router.get('/:layoutId/spots', getSpotsByLayoutController);
router.get('/spots/:spotId', getSpotByIdController);
router.post('/:layoutId/spots', createSpotController);
router.put('/spots/:spotId', updateSpotController);
router.delete('/spots/:spotId', deleteSpotController);

router.get('/spots/:spotId/videos', getVideosBySpotController);
router.get('/videos/:videoId', getVideoByIdController);
router.post('/spots/:spotId/videos', uploadVideo.single('video'), createVideoController);
router.put('/videos/:videoId', uploadVideo.single('video'), updateVideoController);
router.delete('/videos/:videoId', deleteVideoController);

// Admin/health check endpoint - todo this should be something for an admin. for now it's unused but important to remember it's a thing that should be checked sometime/somehow
router.get('/compare/cloudinary', compareLayoutsWithCloudinaryController);

export default router;

