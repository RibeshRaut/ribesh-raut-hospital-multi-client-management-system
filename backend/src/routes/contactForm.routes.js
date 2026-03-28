import express from 'express';
import {
  submitContactForm,
  getContactFormsByHospital,
  getContactFormById,
  updateContactFormStatus,
  deleteContactForm,
} from '../controllers/contactForm.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  requireHospitalSubscription,
  requireSubscriptionByHospitalBody,
} from '../middlewares/subscription.middleware.js';

const router = express.Router();

router.post('/', requireSubscriptionByHospitalBody, submitContactForm);
router.get('/hospital/:hospitalId', authenticate, requireHospitalSubscription, getContactFormsByHospital);
router.get('/:formId', authenticate, requireHospitalSubscription, getContactFormById);
router.put('/:formId', authenticate, requireHospitalSubscription, updateContactFormStatus);
router.delete('/:formId', authenticate, requireHospitalSubscription, deleteContactForm);

export default router;
