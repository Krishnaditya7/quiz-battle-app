import express from 'express';
import { login, signup, getMe, logout } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = express.Router();

//Public routes
router.post('/signup', signup);
router.post('/login', login);

//private route ke liye authentication is required
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;