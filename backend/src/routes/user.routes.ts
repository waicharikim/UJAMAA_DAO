import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js'; // Ensure you have this

const router = express.Router();

router.post('/', userController.createUserHandler); // Registration is public

router.use(authMiddleware); // Protect all below

router.get('/me', userController.getCurrentUserHandler);
router.patch('/me', userController.updateUserHandler);

export default router;