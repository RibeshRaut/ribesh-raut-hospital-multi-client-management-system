import express from 'express';
import {
  createCheckoutSession,
  handleStripeWebhook,
  getPaymentStatus,
  verifyPaymentSession,
  confirmPaidAppointment,
} from '../controllers/payment.controller.js';

const router = express.Router();

// Create Stripe Checkout Session for appointment payment
router.post('/create-checkout-session', createCheckoutSession);

// Get payment status for an appointment
router.get('/status/:appointmentId', getPaymentStatus);

// Verify payment session
router.get('/verify/:sessionId', verifyPaymentSession);

// Confirm appointment after successful payment redirect (webhook fallback)
router.post('/confirm/:appointmentId', confirmPaidAppointment);

export default router;
