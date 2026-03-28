import express from 'express';
import {
  createService,
  getServicesByHospital,
  getServiceById,
  updateService,
  deleteService,
  getServiceCategories,
} from '../controllers/service.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireHospitalSubscription } from '../middlewares/subscription.middleware.js';

const router = express.Router();

router.post('/', authenticate, requireHospitalSubscription, createService);
router.get('/hospital/:hospitalId', authenticate, requireHospitalSubscription, getServicesByHospital);
router.get('/categories/:hospitalId', authenticate, requireHospitalSubscription, getServiceCategories);
router.get('/:serviceId', authenticate, requireHospitalSubscription, getServiceById);
router.put('/:serviceId', authenticate, requireHospitalSubscription, updateService);
router.delete('/:serviceId', authenticate, requireHospitalSubscription, deleteService);

export default router;
