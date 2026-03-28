import express from 'express';
import {
  createAppointmentRequest,
  getAppointmentsByDoctor,
  getAppointmentsByUser,
  getAppointmentsByHospital,
  updateAppointmentStatus,
  cancelAppointment,
  getAvailableSlots,
  getAppointmentById,
  getPatients,
  getPatientHistory,
} from '../controllers/appointment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  requireHospitalSubscription,
  requireSubscriptionByHospitalBody,
} from '../middlewares/subscription.middleware.js';

const router = express.Router();

// Public routes
router.post('/request', requireSubscriptionByHospitalBody, createAppointmentRequest);
router.get('/available-slots', getAvailableSlots);

// Protected routes
router.get('/by-user/:userId', authenticate, getAppointmentsByUser);
router.get('/by-doctor/:doctorId', authenticate, requireHospitalSubscription, getAppointmentsByDoctor);
router.get('/by-hospital/:hospitalId', authenticate, requireHospitalSubscription, getAppointmentsByHospital);
router.get('/:appointmentId', authenticate, getAppointmentById);

// Patient routes (derived from appointments)
router.get('/patients/:hospitalId', authenticate, requireHospitalSubscription, getPatients);
router.get('/patients/:hospitalId/:patientEmail', authenticate, requireHospitalSubscription, getPatientHistory);

// Admin routes
router.put('/:appointmentId/status', authenticate, requireHospitalSubscription, updateAppointmentStatus);
router.put('/:appointmentId/cancel', authenticate, requireHospitalSubscription, cancelAppointment);

export default router;
