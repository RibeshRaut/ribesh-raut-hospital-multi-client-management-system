import express from 'express';
import {
  createSubscriptionCheckout,
  getSubscriptionDetails,
  getAvailablePlans,
  cancelSubscription,
  updateSubscriptionPlan,
  confirmSubscriptionCheckoutSession,
} from '../controllers/subscription.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Get available subscription plans (public)
router.get('/plans', getAvailablePlans);

// Create subscription checkout session (authenticated)
router.post('/create-checkout-session', authenticate, createSubscriptionCheckout);

// Get subscription details for a hospital (authenticated)
router.get('/details/:hospitalId', authenticate, getSubscriptionDetails);

// Confirm subscription checkout session after redirect (authenticated)
router.get('/confirm/:sessionId', authenticate, confirmSubscriptionCheckoutSession);

// Cancel subscription (authenticated)
router.post('/cancel/:hospitalId', authenticate, cancelSubscription);

// Update subscription plan (authenticated)
router.put('/update-plan/:hospitalId', authenticate, updateSubscriptionPlan);

export default router;
