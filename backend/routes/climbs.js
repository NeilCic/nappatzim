import express from 'express';
import multer from 'multer';
import {
  getClimbByIdController,
  updateClimbController,
  deleteClimbController,
} from '../controllers/climbController.js';
import {
  getVideosByClimbController,
  createVideoController,
} from '../controllers/layoutController.js';
import {
  getVotesByClimbController,
  getVoteStatisticsController,
  getMyVoteController,
  submitVoteController,
  deleteVoteController,
} from '../controllers/voteController.js';
import {
  getCommentsByClimbController,
  createCommentController,
  updateCommentController,
  deleteCommentController,
} from '../controllers/commentController.js';
import {
  submitReactionController,
  removeReactionController,
} from '../controllers/reactionController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

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

router.get('/:climbId', getClimbByIdController);
router.put('/:climbId', updateClimbController);
router.delete('/:climbId', deleteClimbController);

router.get('/:climbId/votes/statistics', getVoteStatisticsController);
router.get('/:climbId/votes/me', getMyVoteController);
router.get('/:climbId/votes', getVotesByClimbController);
router.post('/:climbId/votes', submitVoteController);
router.delete('/:climbId/votes', deleteVoteController);

router.get('/:climbId/comments', getCommentsByClimbController);
router.post('/:climbId/comments', createCommentController);
router.put('/:climbId/comments/:commentId', updateCommentController);
router.delete('/:climbId/comments/:commentId', deleteCommentController);

router.post('/:climbId/comments/:commentId/reactions', submitReactionController);
router.delete('/:climbId/comments/:commentId/reactions', removeReactionController);

router.get('/:climbId/videos', getVideosByClimbController);
router.post('/:climbId/videos', uploadVideo.single('video'), createVideoController);

export default router;
