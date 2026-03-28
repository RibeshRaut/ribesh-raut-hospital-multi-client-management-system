import express from 'express';
import {
  createDoctor,
  getDoctorsByHospital,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  uploadDoctorPhotoController,
  getSpecialties,
} from '../controllers/doctor.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireHospitalSubscription } from '../middlewares/subscription.middleware.js';
import { uploadDoctorPhoto, handleUploadError } from '../middlewares/upload.middleware.js';

const router = express.Router();

router.post('/', authenticate, requireHospitalSubscription, createDoctor);
router.get('/hospital/:hospitalId', authenticate, requireHospitalSubscription, getDoctorsByHospital);
router.get('/specialties/:hospitalId', authenticate, requireHospitalSubscription, getSpecialties);
router.get('/:doctorId', authenticate, requireHospitalSubscription, getDoctorById);
router.put('/:doctorId', authenticate, requireHospitalSubscription, updateDoctor);
router.delete('/:doctorId', authenticate, requireHospitalSubscription, deleteDoctor);

// Photo upload route
router.post('/:doctorId/photo', authenticate, requireHospitalSubscription, uploadDoctorPhoto, handleUploadError, uploadDoctorPhotoController);

export default router;
