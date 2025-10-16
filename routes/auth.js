import express from 'express';
import { addUser, login, refresh } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', addUser);
router.post('/login', login);
router.post('/refresh', refresh);

export default router;