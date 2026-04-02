import express from 'express';
import {
  createCheckoutSession,
  handleStripeWebhook,
  getPaymentStatus,
  verifyPaymentSession,
  confirmPaidAppointment,
  sendRemainingPaymentLink,
} from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireHospitalSubscription } from '../middlewares/subscription.middleware.js';

const router = express.Router();

// Create Stripe Checkout Session for appointment payment
router.post('/create-checkout-session', createCheckoutSession);

// Get payment status for an appointment
router.get('/status/:appointmentId', getPaymentStatus);

// Verify payment session
router.get('/verify/:sessionId', verifyPaymentSession);

// Confirm appointment after successful payment redirect (webhook fallback)
router.post('/confirm/:appointmentId', confirmPaidAppointment);

// Send remaining payment link to patient (hospital admin)
router.post('/appointments/:appointmentId/send-remaining-link', authenticate, requireHospitalSubscription, sendRemainingPaymentLink);

export default router;
