import express from 'express';
import { login, SignUp, getMe, logout } from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

//Public routes
router.post('/signup', SignUp);
router.post('/login', login);

//private route ke liye authentication is required
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

export default router;