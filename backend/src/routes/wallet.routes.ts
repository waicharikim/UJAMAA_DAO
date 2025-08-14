import express from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { attachUserRoles } from '../middlewares/attachUserRoles.middleware.js';
import { authorize } from '../middlewares/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(attachUserRoles);

const allowedRoles = ['wallet:user', 'wallet:group_admin', 'wallet:admin'];

// Wallet balance endpoint
router.get('/balance', authorize(allowedRoles), walletController.getBalanceHandler);

// Wallet transactions list
router.get('/transactions', authorize(allowedRoles), walletController.getTransactionsHandler);

export default router;