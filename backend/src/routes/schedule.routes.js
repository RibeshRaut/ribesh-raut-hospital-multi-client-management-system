import express from 'express';
import {
  createSchedule,
  getSchedulesByHospital,
  getScheduleById,
  getScheduleByDoctor,
  updateSchedule,
  deleteSchedule,
  getPublicSchedulesByHospital,
} from '../controllers/schedule.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  requireHospitalSubscription,
  requireSubscriptionByHospitalParam,
} from '../middlewares/subscription.middleware.js';

const router = express.Router();

// Public routes (no auth required)
router.get('/public/hospital/:hospitalId', requireSubscriptionByHospitalParam, getPublicSchedulesByHospital);

// Protected routes
router.post('/', authenticate, requireHospitalSubscription, createSchedule);
router.get('/hospital/:hospitalId', authenticate, requireHospitalSubscription, getSchedulesByHospital);
router.get('/doctor/:doctorId', authenticate, requireHospitalSubscription, getScheduleByDoctor);
router.get('/:scheduleId', authenticate, requireHospitalSubscription, getScheduleById);
router.put('/:scheduleId', authenticate, requireHospitalSubscription, updateSchedule);
router.delete('/:scheduleId', authenticate, requireHospitalSubscription, deleteSchedule);

export default router;
