import express from 'express';
import { addUser, login, refresh, updateUsername, getCurrentUser } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts only
  message: 'Too many authentication attempts, please try again later.'
});

router.post('/register', authLimiter, addUser);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.get('/me', verifyToken, getCurrentUser);
router.patch('/username', verifyToken, updateUsername);

export default router;