import express from 'express';
import {
  getDashboardStats,
  getDashboardOverview,
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireHospitalSubscription } from '../middlewares/subscription.middleware.js';

const router = express.Router();

// Get dashboard statistics (with auth)
router.get('/stats/:hospitalId', authenticate, requireHospitalSubscription, getDashboardStats);

// Get dashboard overview (with auth)
router.get('/overview/:hospitalId', authenticate, requireHospitalSubscription, getDashboardOverview);

export default router;
